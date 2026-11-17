/**
 * Maintenance engine: odometer readings, effective service intervals, upcoming items,
 * and the alert drafts consumed by the alerts workstream (see docs/agents/CONTRACTS.md).
 *
 * Every function takes `today` (YYYY-MM-DD) instead of reading the clock.
 */
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lt, lte, or } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { documents, odometerReadings, serviceEvents, serviceIntervals, vehicles } from '@/models/db/schema';
import type { AlertDraft } from '@/shared/contracts';
import { badRequest } from '@/models/errors';
import { DEFAULT_SERVICE_INTERVALS } from '@/models/config/service-intervals';
import { addDays, addMonths, diffDays, fmtShort, statusText } from './dates';
import { badgesFor, vehicleLabel, type Badge } from './labels';

export type OdometerSource = 'manual' | 'appraisal' | 'service' | 'purchase';
type Vehicle = typeof vehicles.$inferSelect;
type ServiceEvent = typeof serviceEvents.$inferSelect;

const DAYS_PER_MONTH = 30.4375;
/** Only used to ORDER mileage items when no miles/month estimate exists. Never displayed. */
const FALLBACK_SORT_MILES_PER_MONTH = 1_000;
/** Mileage alerts fire when this close to (or past) the due mileage. */
const MILEAGE_ALERT_WINDOW = 500;
const DATE_ALERT_WINDOW_DAYS = 7;
const RENEWAL_WINDOW_DAYS = 30;

/* -------------------------------------------------------------- odometer */

/**
 * Store an odometer reading. Readings must be monotonic by date: throws 400 `invalid_input`
 * if an earlier-or-same-day reading has more miles, or a later reading has fewer.
 * Updates vehicles.odometer when this is the newest reading by date.
 */
export async function recordOdometer(
  db: Db,
  vehicleId: string,
  miles: number,
  on: string,
  source: OdometerSource,
  field = 'miles',
): Promise<void> {
  const [conflict] = await db
    .select({ miles: odometerReadings.miles, recordedOn: odometerReadings.recordedOn })
    .from(odometerReadings)
    .where(and(
      eq(odometerReadings.vehicleId, vehicleId),
      or(
        and(lte(odometerReadings.recordedOn, on), gt(odometerReadings.miles, miles)),
        and(gt(odometerReadings.recordedOn, on), lt(odometerReadings.miles, miles)),
      ),
    ))
    // Cite the highest conflicting reading (usually the latest), not an old one.
    .orderBy(desc(odometerReadings.miles))
    .limit(1);
  if (conflict) {
    const day = new Date(`${conflict.recordedOn}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const later = conflict.recordedOn > on;
    const msg = later
      ? `The odometer read ${conflict.miles.toLocaleString('en-US')} mi on ${day}, after this date. Enter a lower reading or a later date.`
      : `The odometer already read ${conflict.miles.toLocaleString('en-US')} mi on ${day}. Enter at least that, or an earlier date.`;
    throw badRequest(msg, { [field]: [msg] });
  }
  await db.insert(odometerReadings).values({ vehicleId, miles, recordedOn: on, source });
  const [newer] = await db
    .select({ id: odometerReadings.id })
    .from(odometerReadings)
    .where(and(eq(odometerReadings.vehicleId, vehicleId), gt(odometerReadings.recordedOn, on)))
    .limit(1);
  if (!newer) await db.update(vehicles).set({ odometer: miles, updatedAt: new Date() }).where(eq(vehicles.id, vehicleId));
}

/**
 * Estimated miles driven per month, or null when there is not enough history.
 *
 * Needs readings spanning at least 30 days. Fits a least-squares line of miles against
 * days (all readings, any source) and converts the slope to miles per average month
 * (30.4375 days). With two readings this equals (last - first) / span. Returns null for a
 * non-positive slope. Rounded to whole miles.
 */
export async function milesPerMonth(db: Db, vehicleId: string): Promise<number | null> {
  const rows = await db
    .select({ miles: odometerReadings.miles, on: odometerReadings.recordedOn })
    .from(odometerReadings)
    .where(eq(odometerReadings.vehicleId, vehicleId))
    .orderBy(asc(odometerReadings.recordedOn));
  return estimateMilesPerMonth(rows);
}

export function estimateMilesPerMonth(rows: { miles: number; on: string }[]): number | null {
  if (rows.length < 2) return null;
  const first = rows[0]!.on;
  const xs = rows.map((r) => diffDays(first, r.on));
  if (Math.max(...xs) - Math.min(...xs) < 30) return null;
  const ys = rows.map((r) => r.miles);
  const n = rows.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0) return null;
  const perDay = num / den;
  if (perDay <= 0) return null;
  return Math.round(perDay * DAYS_PER_MONTH);
}

/* ------------------------------------------------------------- intervals */

export type EffectiveInterval = {
  type: string; title: string; everyMiles: number | null; everyMonths: number | null;
  /** 'user' | 'default' | 'manufacturer' | ... ; 'default' rows come from src/config/service-intervals.ts */
  source: string;
  scope: 'vehicle' | 'model' | 'default';
};

/** Vehicle rows override model-wide rows, which override generic defaults (matched by type). */
export async function effectiveIntervals(db: Db, v: Pick<Vehicle, 'id' | 'modelKey'>): Promise<EffectiveInterval[]> {
  const rows = await db
    .select()
    .from(serviceIntervals)
    .where(or(eq(serviceIntervals.vehicleId, v.id), eq(serviceIntervals.modelKey, v.modelKey)));
  const byType = new Map<string, EffectiveInterval>();
  for (const d of DEFAULT_SERVICE_INTERVALS) byType.set(d.type, { ...d, scope: 'default' });
  for (const r of rows.filter((r) => !r.vehicleId && r.modelKey === v.modelKey)) {
    byType.set(r.type, { type: r.type, title: r.title, everyMiles: r.everyMiles, everyMonths: r.everyMonths, source: r.source, scope: 'model' });
  }
  for (const r of rows.filter((r) => r.vehicleId === v.id)) {
    byType.set(r.type, { type: r.type, title: r.title, everyMiles: r.everyMiles, everyMonths: r.everyMonths, source: r.source, scope: 'vehicle' });
  }
  return [...byType.values()].filter((i) => i.everyMiles || i.everyMonths);
}

/** Replace a vehicle's own interval rows (source 'user'). Types not listed fall back to model/defaults. */
export async function setVehicleIntervals(
  db: Db,
  vehicleId: string,
  list: { type: string; title: string; everyMiles: number | null; everyMonths: number | null }[],
): Promise<void> {
  await db.delete(serviceIntervals).where(eq(serviceIntervals.vehicleId, vehicleId));
  if (list.length) {
    await db.insert(serviceIntervals).values(list.map((i) => ({ vehicleId, type: i.type, title: i.title, everyMiles: i.everyMiles, everyMonths: i.everyMonths, source: 'user' })));
  }
}

/* -------------------------------------------------------------- upcoming */

export type UpcomingDateItem = {
  kind: 'date';
  /** 'event' = a scheduled service_events row; 'interval' = due date derived from an interval by months. */
  source: 'event' | 'interval';
  eventId: string | null;
  vehicleId: string;
  vehicle?: Badge;
  type: string;
  title: string;
  date: string;
  daysUntil: number;
  overdue: boolean;
  /** "in 6 days" | "today" | "3 days overdue" */
  statusText: string;
  urgencyDays: number;
};

export type UpcomingMileageItem = {
  kind: 'mileage';
  source: 'interval';
  eventId: null;
  vehicleId: string;
  vehicle?: Badge;
  type: string;
  title: string;
  currentMiles: number;
  dueAtMiles: number;
  /** Negative when past due. */
  milesLeft: number;
  overdue: boolean;
  /** Estimated date the due mileage is reached (null if overdue or no miles/month estimate). */
  projectedDate: string | null;
  milesPerMonth: number | null;
  /** "1,800 mi left" | "200 mi overdue" */
  statusText: string;
  urgencyDays: number;
};

export type UpcomingItem = UpcomingDateItem | UpcomingMileageItem;

const fmtMi = (n: number) => n.toLocaleString('en-US');

/** All upcoming items for one vehicle (unsorted). */
export async function vehicleUpcoming(db: Db, v: Vehicle, today: string): Promise<UpcomingItem[]> {
  const [events, intervals, mpm] = await Promise.all([
    db.select().from(serviceEvents).where(and(eq(serviceEvents.vehicleId, v.id), inArray(serviceEvents.status, ['scheduled', 'done']))),
    effectiveIntervals(db, v),
    milesPerMonth(db, v.id),
  ]);
  const items: UpcomingItem[] = [];
  const scheduledTypes = new Set<string>();

  for (const e of events.filter((e) => e.status === 'scheduled')) {
    scheduledTypes.add(e.type);
    const daysUntil = diffDays(today, e.date);
    items.push({
      kind: 'date', source: 'event', eventId: e.id, vehicleId: v.id, type: e.type, title: e.title, date: e.date,
      daysUntil, overdue: daysUntil < 0, statusText: statusText(e.date, today), urgencyDays: daysUntil,
    });
  }

  const done = events.filter((e) => e.status === 'done');
  const lastDone = (type: string, needOdo: boolean): ServiceEvent | undefined =>
    done
      .filter((e) => e.type === type && (!needOdo || e.odometer !== null))
      .sort((a, b) => (needOdo ? b.odometer! - a.odometer! : 0) || b.date.localeCompare(a.date))[0];

  for (const iv of intervals) {
    if (iv.everyMonths && !scheduledTypes.has(iv.type)) {
      const last = lastDone(iv.type, false);
      let due: string | null = null;
      if (last) {
        due = addMonths(last.date, iv.everyMonths);
      } else if (v.purchaseDate) {
        // No history: roll forward from purchase to the next cycle on or after today.
        let k = 1;
        due = addMonths(v.purchaseDate, iv.everyMonths);
        while (due < today && k < 1000) due = addMonths(v.purchaseDate, iv.everyMonths * ++k);
      }
      if (due) {
        const daysUntil = diffDays(today, due);
        items.push({
          kind: 'date', source: 'interval', eventId: null, vehicleId: v.id, type: iv.type, title: iv.title, date: due,
          daysUntil, overdue: daysUntil < 0, statusText: statusText(due, today), urgencyDays: daysUntil,
        });
      }
    }
    if (iv.everyMiles) {
      const last = lastDone(iv.type, true);
      const current = v.odometer;
      let dueAt: number;
      if (last) {
        dueAt = last.odometer! + iv.everyMiles;
      } else {
        // No history: next multiple of the interval above the current reading, counted from purchase (or 0).
        const base = v.purchaseOdometer ?? 0;
        dueAt = current < base ? base + iv.everyMiles : base + iv.everyMiles * (Math.floor((current - base) / iv.everyMiles) + 1);
      }
      const milesLeft = dueAt - current;
      const overdue = milesLeft < 0;
      const projectedDays = milesLeft > 0 && mpm ? Math.round((milesLeft / mpm) * DAYS_PER_MONTH) : null;
      items.push({
        kind: 'mileage', source: 'interval', eventId: null, vehicleId: v.id, type: iv.type, title: iv.title,
        currentMiles: current, dueAtMiles: dueAt, milesLeft, overdue,
        projectedDate: projectedDays === null ? null : addDays(today, projectedDays),
        milesPerMonth: mpm,
        statusText: milesLeft >= 0 ? `${fmtMi(milesLeft)} mi left` : `${fmtMi(-milesLeft)} mi overdue`,
        urgencyDays: milesLeft <= 0 ? -1 : (projectedDays ?? (milesLeft / FALLBACK_SORT_MILES_PER_MONTH) * DAYS_PER_MONTH),
      });
    }
  }
  return items;
}

export function sortByUrgency<T extends UpcomingItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.urgencyDays - b.urgencyDays || a.title.localeCompare(b.title));
}

/** Upcoming maintenance across a user's vehicles (or one), most urgent first. */
export async function upcomingMaintenance(
  db: Db, userId: string, today: string, opts: { vehicleId?: string; limit?: number } = {},
): Promise<UpcomingItem[]> {
  const all = await db.select().from(vehicles).where(eq(vehicles.userId, userId));
  const badges = badgesFor(all);
  const list = opts.vehicleId ? all.filter((v) => v.id === opts.vehicleId) : all;
  const items: UpcomingItem[] = [];
  for (const v of list) {
    for (const it of await vehicleUpcoming(db, v, today)) items.push({ ...it, vehicle: badges.get(v.id) });
  }
  const sorted = sortByUrgency(items);
  return opts.limit ? sorted.slice(0, opts.limit) : sorted;
}

/** Earliest date-based item (overdue first) for a vehicle, as shown on Garage and Overview. */
export function nextServiceOf(items: UpcomingItem[]): { title: string; date: string; statusText: string; overdue: boolean } | null {
  const d = items
    .filter((i): i is UpcomingDateItem => i.kind === 'date')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.source === 'event' ? -1 : 1))[0];
  return d ? { title: d.title, date: d.date, statusText: d.statusText, overdue: d.overdue } : null;
}

/* ---------------------------------------------------------------- alerts */

/**
 * Maintenance alert drafts for every vehicle: scheduled/interval date items overdue or due
 * within 7 days, and mileage items within 500 mi (or past). Dedupe keys:
 *   maint:<eventId>:overdue | maint:<eventId>:due7                    (scheduled events)
 *   maint:<vehicleId>:<type>:<dueDate>:overdue | ...:due7             (interval by months)
 *   maint:<vehicleId>:<type>:<dueAtMiles>:mi500                       (interval by miles)
 */
export async function dueMaintenanceAlerts(db: Db, today: string): Promise<AlertDraft[]> {
  const all = await db.select().from(vehicles);
  const drafts: AlertDraft[] = [];
  for (const v of all) {
    const label = vehicleLabel(v);
    const link = `/garage/${v.id}/maintenance`;
    const items = await vehicleUpcoming(db, v, today);
    const scheduledTypes = new Set(items.filter((i) => i.source === 'event').map((i) => i.type));
    for (const it of items) {
      if (it.kind === 'date') {
        const base = it.eventId ? `maint:${it.eventId}` : `maint:${v.id}:${it.type}:${it.date}`;
        if (it.daysUntil < 0) {
          drafts.push({
            userId: v.userId, type: 'maintenance', vehicleId: v.id, link,
            title: `${it.title} is ${it.statusText}`,
            body: `${label}: ${it.source === 'event' ? 'scheduled for' : 'was due'} ${fmtShort(it.date)}.`,
            dedupeKey: `${base}:overdue`,
          });
        } else if (it.daysUntil <= DATE_ALERT_WINDOW_DAYS) {
          drafts.push({
            userId: v.userId, type: 'maintenance', vehicleId: v.id, link,
            title: `${it.title} is due ${it.statusText}`,
            body: `${label}: ${it.source === 'event' ? 'scheduled for' : 'due'} ${fmtShort(it.date)}.`,
            dedupeKey: `${base}:due7`,
          });
        }
      } else if (it.milesLeft <= MILEAGE_ALERT_WINDOW && !scheduledTypes.has(it.type)) {
        const title = it.milesLeft > 0 ? `${it.title} is due in ${fmtMi(it.milesLeft)} mi`
          : it.milesLeft === 0 ? `${it.title} is due now` : `${it.title} is ${fmtMi(-it.milesLeft)} mi overdue`;
        drafts.push({
          userId: v.userId, type: 'maintenance', vehicleId: v.id, link, title,
          body: `${label}: due at ${fmtMi(it.dueAtMiles)} mi, odometer at ${fmtMi(it.currentMiles)} mi.`,
          dedupeKey: `maint:${v.id}:${it.type}:${it.dueAtMiles}:mi500`,
        });
      }
    }
  }
  return drafts;
}

/** Calendar/alert wording for an expiring document. */
export function renewalTitle(kind: string, label: string | null): string {
  switch (kind) {
    case 'insurance': return 'Insurance renews';
    case 'registration': return 'Registration renews';
    case 'inspection': return 'Inspection due';
    case 'title': return 'Title expires';
    default: return `${label || 'Document'} expires`;
  }
}

/**
 * Documents whose expiresOn falls within the next 30 days (today inclusive).
 * Dedupe key: renew:<docId>:<expiresOn>:30d (a new expiry date alerts again).
 */
export async function renewalAlerts(db: Db, today: string): Promise<AlertDraft[]> {
  const rows = await db
    .select({ doc: documents, vehicle: vehicles })
    .from(documents)
    .innerJoin(vehicles, eq(documents.vehicleId, vehicles.id))
    .where(and(isNotNull(documents.expiresOn), gte(documents.expiresOn, today), lte(documents.expiresOn, addDays(today, RENEWAL_WINDOW_DAYS))))
    .orderBy(asc(documents.expiresOn), desc(documents.createdAt));
  return rows.map(({ doc, vehicle }) => ({
    userId: vehicle.userId,
    type: 'renewal' as const,
    vehicleId: vehicle.id,
    title: `${renewalTitle(doc.kind, doc.label)} ${fmtShort(doc.expiresOn!)}`,
    body: `${vehicleLabel(vehicle)}: ${statusText(doc.expiresOn!, today)}.`,
    link: `/garage/${vehicle.id}`,
    dedupeKey: `renew:${doc.id}:${doc.expiresOn}:30d`,
  }));
}
