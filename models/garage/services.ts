/** Service events: CRUD, calendar range, log (JSON + CSV) and yearly spend. */
import { and, asc, desc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/models/db';
import { documents, serviceEvents, vehicles } from '@/models/db/schema';
import { badRequest, notFound } from '@/models/errors';
import { idSchema, isoDateSchema, mileageSchema } from '@/models/validation';
import { diffDays, yearRange } from './dates';
import { badgesFor, vehicleLabel } from './labels';
import { recordOdometer, renewalTitle } from './maintenance';

type ServiceEvent = typeof serviceEvents.$inferSelect;

const costCentsSchema = z.number().int('Cost is in whole cents.').min(0).max(100_000_000);
const text = (max: number) => z.string().trim().max(max).nullable().optional();
export const serviceTypeSchema = z.string().trim().min(1).max(40).regex(/^[a-z0-9_]+$/, 'Use a type key like oil_filter.');

export const createEventSchema = z.object({
  vehicleId: idSchema,
  type: serviceTypeSchema,
  title: z.string().trim().min(1).max(120),
  date: isoDateSchema,
  status: z.enum(['scheduled', 'done']).default('scheduled'),
  odometer: mileageSchema.nullable().optional(),
  costCents: costCentsSchema.nullable().optional(),
  shop: text(120),
  notes: text(2000),
  receiptDocumentId: idSchema.nullable().optional(),
});

export const patchEventSchema = z
  .object({
    status: z.enum(['scheduled', 'done', 'skipped']).optional(),
    date: isoDateSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    odometer: mileageSchema.nullable().optional(),
    costCents: costCentsSchema.nullable().optional(),
    shop: text(120),
    notes: text(2000),
    receiptDocumentId: idSchema.nullable().optional(),
  })
  .strict();

export function eventDto(e: ServiceEvent, today: string) {
  return {
    id: e.id, vehicleId: e.vehicleId, type: e.type, title: e.title, date: e.date, status: e.status,
    overdue: e.status === 'scheduled' && diffDays(today, e.date) < 0,
    odometer: e.odometer, costCents: e.costCents, shop: e.shop, notes: e.notes, receiptDocumentId: e.receiptDocumentId,
    completedAt: e.completedAt?.toISOString() ?? null,
  };
}

export async function requireEvent(db: Db, userId: string, id: string): Promise<ServiceEvent> {
  const [row] = await db
    .select({ e: serviceEvents })
    .from(serviceEvents)
    .innerJoin(vehicles, eq(serviceEvents.vehicleId, vehicles.id))
    .where(and(eq(serviceEvents.id, id), eq(vehicles.userId, userId)))
    .limit(1);
  if (!row) throw notFound('Service event');
  return row.e;
}

async function assertReceipt(db: Db, vehicleId: string, docId: string | null | undefined) {
  if (!docId) return;
  const [d] = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, docId), eq(documents.vehicleId, vehicleId))).limit(1);
  if (!d) throw notFound('Receipt document');
}

/** Caller must have checked vehicle ownership. Done events with an odometer record a reading (source 'service'). */
export async function createEvent(db: Db, input: z.infer<typeof createEventSchema>, today: string) {
  await assertReceipt(db, input.vehicleId, input.receiptDocumentId);
  if (input.status === 'done' && input.date > today) throw badRequest('A completed service cannot be dated in the future.', { date: ['Date is in the future.'] });
  if (input.status === 'done' && input.odometer != null) await recordOdometer(db, input.vehicleId, input.odometer, input.date, 'service');
  const [e] = await db
    .insert(serviceEvents)
    .values({
      vehicleId: input.vehicleId, type: input.type, title: input.title, date: input.date, status: input.status,
      odometer: input.odometer ?? null, costCents: input.costCents ?? null, shop: input.shop ?? null, notes: input.notes ?? null,
      receiptDocumentId: input.receiptDocumentId ?? null, completedAt: input.status === 'done' ? new Date() : null,
    })
    .returning();
  return eventDto(e!, today);
}

export async function updateEvent(db: Db, e: ServiceEvent, patch: z.infer<typeof patchEventSchema>, today: string) {
  await assertReceipt(db, e.vehicleId, patch.receiptDocumentId);
  const status = patch.status ?? e.status;
  const date = patch.date ?? e.date;
  if (status === 'done' && date > today) throw badRequest('A completed service cannot be dated in the future.', { date: ['Date is in the future.'] });
  const odometer = patch.odometer !== undefined ? patch.odometer : e.odometer;
  const newlyRecorded = status === 'done' && odometer != null && (e.status !== 'done' || odometer !== e.odometer);
  if (newlyRecorded) await recordOdometer(db, e.vehicleId, odometer, date, 'service');
  const [row] = await db
    .update(serviceEvents)
    .set({
      status, date, odometer,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.costCents !== undefined ? { costCents: patch.costCents } : {}),
      ...(patch.shop !== undefined ? { shop: patch.shop } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.receiptDocumentId !== undefined ? { receiptDocumentId: patch.receiptDocumentId } : {}),
      completedAt: status === 'done' ? (e.completedAt ?? new Date()) : null,
    })
    .where(eq(serviceEvents.id, e.id))
    .returning();
  return eventDto(row!, today);
}

/* -------------------------------------------------------------- calendar */

export type CalendarItem = {
  kind: 'service' | 'renewal';
  id: string;
  vehicleId: string;
  vehicle: { letter: string; label: string; short: string; index: number };
  type: string;
  title: string;
  date: string;
  status: 'scheduled' | 'done' | 'skipped' | 'renewal';
  overdue: boolean;
};

export async function calendar(db: Db, userId: string, args: { from: string; to: string; vehicleId?: string }, today: string) {
  const all = await db.select().from(vehicles).where(eq(vehicles.userId, userId));
  const badges = badgesFor(all);
  const ids = (args.vehicleId ? all.filter((v) => v.id === args.vehicleId) : all).map((v) => v.id);
  if (!ids.length) return [];
  const [events, docs] = await Promise.all([
    db.select().from(serviceEvents).where(and(inArray(serviceEvents.vehicleId, ids), gte(serviceEvents.date, args.from), lte(serviceEvents.date, args.to))),
    db.select().from(documents).where(and(inArray(documents.vehicleId, ids), isNotNull(documents.expiresOn), gte(documents.expiresOn, args.from), lte(documents.expiresOn, args.to))),
  ]);
  const items: CalendarItem[] = [
    ...events.map((e) => ({
      kind: 'service' as const, id: e.id, vehicleId: e.vehicleId, vehicle: badges.get(e.vehicleId)!, type: e.type, title: e.title,
      date: e.date, status: e.status, overdue: e.status === 'scheduled' && e.date < today,
    })),
    ...docs.map((d) => ({
      kind: 'renewal' as const, id: d.id, vehicleId: d.vehicleId, vehicle: badges.get(d.vehicleId)!, type: d.kind,
      title: renewalTitle(d.kind, d.label), date: d.expiresOn!, status: 'renewal' as const, overdue: d.expiresOn! < today,
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/* ------------------------------------------------------------------- log */

export type LogRow = {
  id: string; date: string; vehicleId: string; vehicle: string; vehicleLabel: string; service: string; type: string;
  miles: number | null; costCents: number | null; shop: string | null;
  receipt: { documentId: string; url: string } | null;
};

export async function serviceLog(db: Db, userId: string, args: { year: number; vehicleId?: string }): Promise<LogRow[]> {
  const { from, to } = yearRange(args.year);
  const all = await db.select().from(vehicles).where(eq(vehicles.userId, userId));
  const badges = badgesFor(all);
  const byId = new Map(all.map((v) => [v.id, v]));
  const ids = (args.vehicleId ? all.filter((v) => v.id === args.vehicleId) : all).map((v) => v.id);
  if (!ids.length) return [];
  const rows = await db
    .select()
    .from(serviceEvents)
    .where(and(inArray(serviceEvents.vehicleId, ids), eq(serviceEvents.status, 'done'), gte(serviceEvents.date, from), lte(serviceEvents.date, to)))
    .orderBy(desc(serviceEvents.date), desc(serviceEvents.createdAt));
  return rows.map((e) => ({
    id: e.id, date: e.date, vehicleId: e.vehicleId, vehicle: badges.get(e.vehicleId)!.short, vehicleLabel: vehicleLabel(byId.get(e.vehicleId)!),
    service: e.title, type: e.type, miles: e.odometer, costCents: e.costCents, shop: e.shop,
    receipt: e.receiptDocumentId ? { documentId: e.receiptDocumentId, url: `/api/documents/${e.receiptDocumentId}/download` } : null,
  }));
}

/**
 * RFC 4180 field: quoted when it contains a comma, quote, CR or LF; quotes doubled.
 * Text that a spreadsheet would run as a formula (= + - @ tab CR) gets a leading apostrophe.
 */
export function csvField(v: string | number | null | undefined, opts: { text?: boolean } = {}): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (opts.text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function logToCsv(rows: LogRow[], origin = ''): string {
  const header = ['Date', 'Vehicle', 'Service', 'Miles', 'Cost', 'Where', 'Receipt'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvField(r.date),
      csvField(r.vehicleLabel, { text: true }),
      csvField(r.service, { text: true }),
      csvField(r.miles),
      csvField(r.costCents === null ? null : (r.costCents / 100).toFixed(2)),
      csvField(r.shop, { text: true }),
      csvField(r.receipt ? `${origin}${r.receipt.url}` : null),
    ].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/* ----------------------------------------------------------------- spend */

export async function spend(db: Db, userId: string, year: number) {
  const { from, to } = yearRange(year);
  const all = await db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(asc(vehicles.createdAt));
  const badges = badgesFor(all);
  const totals = new Map(all.map((v) => [v.id, 0]));
  if (all.length) {
    const rows = await db
      .select({ vehicleId: serviceEvents.vehicleId, costCents: serviceEvents.costCents })
      .from(serviceEvents)
      .where(and(inArray(serviceEvents.vehicleId, all.map((v) => v.id)), eq(serviceEvents.status, 'done'), gte(serviceEvents.date, from), lte(serviceEvents.date, to)));
    for (const r of rows) totals.set(r.vehicleId, (totals.get(r.vehicleId) ?? 0) + (r.costCents ?? 0));
  }
  const perVehicle = all.map((v) => ({ vehicleId: v.id, label: badges.get(v.id)!.label, vehicleLabel: vehicleLabel(v), totalCents: totals.get(v.id) ?? 0 }));
  return { year, vehicles: perVehicle, totalCents: perVehicle.reduce((a, b) => a + b.totalCents, 0) };
}
