import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/lib/db';
import { appraisals, recallChecks, serviceEvents, vehicles, type DecodedSpecs } from '@/lib/db/schema';
import { badRequest, conflict, notFound } from '@/lib/errors';
import { modelKey } from '@/lib/model-key';
import type { Providers } from '@/lib/providers';
import { decodeVin, mileageFlags } from '@/lib/vin-decode';
import { valuationConfig } from '@/config/valuation';
import { dollarsSchema, idSchema, isoDateSchema, mileageSchema, vinSchema, zipSchema } from '@/lib/validation';
import { documentsSummary } from './documents';
import { fmtCents, fmtUsd } from './format';
import { revLetter, vehicleLabel } from './labels';
import { nextServiceOf, recordOdometer, vehicleUpcoming } from './maintenance';

type Vehicle = typeof vehicles.$inferSelect;

/* --------------------------------------------------------------- schemas */

const nicknameSchema = z.string().trim().max(60).nullable().optional();
const purchaseFields = {
  nickname: nicknameSchema,
  purchasePrice: dollarsSchema().nullable().optional(),
  purchaseDate: isoDateSchema.nullable().optional(),
  purchaseOdometer: mileageSchema.nullable().optional(),
};

export const createFromVinSchema = z.object({
  vin: vinSchema,
  trim: z.string().trim().min(1).max(60).nullable().optional(),
  zip: zipSchema,
  odometer: mileageSchema,
  /** Imported / grey-market: a check digit mismatch becomes a warning instead of a 400. */
  importedVehicle: z.boolean().optional(),
  ...purchaseFields,
});
export const createFromAppraisalSchema = z.object({ fromAppraisalId: idSchema, ...purchaseFields });

export const patchVehicleSchema = z
  .object({
    trim: z.string().trim().min(1).max(60).nullable().optional(),
    zip: zipSchema.optional(),
    odometer: mileageSchema.optional(),
    ...purchaseFields,
  })
  .strict();

type PurchaseInput = { nickname?: string | null; purchasePrice?: number | null; purchaseDate?: string | null; purchaseOdometer?: number | null };

/* --------------------------------------------------------------- helpers */

/** Match a trim against decoded candidates (case-insensitive); returns the canonical spelling. */
export function resolveTrim(specs: DecodedSpecs, trim: string | null | undefined): string | null {
  if (!trim) return null;
  if (!specs.trimCandidates.length) return trim;
  const hit = specs.trimCandidates.find((c) => c.toLowerCase() === trim.toLowerCase());
  if (!hit) throw badRequest(`Pick one of the trims for this VIN: ${specs.trimCandidates.join(', ')}.`, { trim: [`Must be one of: ${specs.trimCandidates.join(', ')}.`] });
  return hit;
}

function checkPurchase(p: PurchaseInput, odometer: number, readingOn: string) {
  if (p.purchaseOdometer != null && p.purchaseOdometer > odometer) {
    throw badRequest('Mileage at purchase cannot be higher than the current odometer.', { purchaseOdometer: ['Higher than the current odometer.'] });
  }
  if (p.purchaseDate && p.purchaseDate > readingOn) {
    throw badRequest('Purchase date cannot be in the future.', { purchaseDate: ['Date is in the future.'] });
  }
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

async function assertVinFree(db: Db, userId: string, vin: string) {
  const [dup] = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.userId, userId), eq(vehicles.vin, vin))).limit(1);
  if (dup) throw conflict('This vehicle is already in your garage.');
}

async function insertVehicle(db: Db, values: typeof vehicles.$inferInsert): Promise<Vehicle> {
  try {
    const [v] = await db.insert(vehicles).values(values).returning();
    return v!;
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('This vehicle is already in your garage.');
    throw err;
  }
}

async function recordInitialReadings(db: Db, v: Vehicle, p: PurchaseInput, miles: number, on: string, source: 'manual' | 'appraisal') {
  if (p.purchaseOdometer != null && p.purchaseDate) await recordOdometer(db, v.id, p.purchaseOdometer, p.purchaseDate, 'purchase');
  await recordOdometer(db, v.id, miles, on, source);
}

/* ---------------------------------------------------------------- create */

export async function createVehicleFromVin(db: Db, providers: Providers, userId: string, input: z.infer<typeof createFromVinSchema>, today: string) {
  checkPurchase(input, input.odometer, today);
  await assertVinFree(db, userId, input.vin);
  const { vin: _vin, warnings, ...specs } = await decodeVin(db, providers, input.vin, { importedVehicle: input.importedVehicle ?? false });
  const trim = resolveTrim(specs, input.trim);
  const v = await insertVehicle(db, {
    userId, vin: input.vin, specs, trim, modelKey: modelKey(specs.make, specs.model, trim), zip: input.zip, odometer: input.odometer,
    nickname: input.nickname ?? null, purchasePrice: input.purchasePrice ?? null, purchaseDate: input.purchaseDate ?? null,
    purchaseOdometer: input.purchaseOdometer ?? null,
  });
  await recordInitialReadings(db, v, input, input.odometer, today, 'manual');
  return { ...(await getVehicle(db, v.id, today)), decodeWarnings: warnings };
}

export async function createVehicleFromAppraisal(db: Db, userId: string, input: z.infer<typeof createFromAppraisalSchema>, today: string) {
  const [a] = await db.select().from(appraisals).where(and(eq(appraisals.id, input.fromAppraisalId), eq(appraisals.userId, userId))).limit(1);
  if (!a) throw notFound('Appraisal');
  const on = a.createdAt.toISOString().slice(0, 10) > today ? today : a.createdAt.toISOString().slice(0, 10);
  checkPurchase(input, a.inputs.mileage, on);
  await assertVinFree(db, userId, a.inputs.vin);
  // Keep the trim only if the user confirmed it (appraisals may auto-fill a single candidate) and it is a valid candidate.
  const confirmed = a.confidence?.trimConfirmedByUser !== false;
  const candidate = confirmed ? (a.inputs.trim ?? null) : null;
  const trim = candidate && (!a.specs.trimCandidates.length || a.specs.trimCandidates.some((c) => c.toLowerCase() === candidate.toLowerCase()))
    ? resolveTrim(a.specs, candidate)
    : null;
  const v = await insertVehicle(db, {
    userId, vin: a.inputs.vin, specs: a.specs, trim, modelKey: modelKey(a.specs.make, a.specs.model, trim), zip: a.inputs.zip,
    odometer: a.inputs.mileage, nickname: input.nickname ?? null, purchasePrice: input.purchasePrice ?? null,
    purchaseDate: input.purchaseDate ?? null, purchaseOdometer: input.purchaseOdometer ?? null,
    lastPrivateValue: a.privateValue.value, lastAppraisedAt: a.createdAt,
  });
  await db.update(appraisals).set({ vehicleId: v.id }).where(eq(appraisals.id, a.id));
  await recordInitialReadings(db, v, input, a.inputs.mileage, on, 'appraisal');
  return getVehicle(db, v.id, today);
}

/* ------------------------------------------------------------ read/write */

/** Mileage sanity flags (e.g. mileage_high_for_age) for the current odometer, relative to `today`. */
export function vehicleFlags(v: Pick<Vehicle, 'odometer' | 'specs'>, today: string): string[] {
  return mileageFlags(v.odometer, v.specs.year, valuationConfig.highMilesPerYear, new Date(`${today}T12:00:00Z`));
}

export function vehicleDto(v: Vehicle, today: string) {
  return {
    flags: vehicleFlags(v, today),
    trimConfirmed: v.trim !== null,
    id: v.id, label: vehicleLabel(v), nickname: v.nickname, vin: v.vin, specs: v.specs, trim: v.trim, modelKey: v.modelKey,
    zip: v.zip, odometer: v.odometer, purchasePrice: v.purchasePrice, purchaseDate: v.purchaseDate, purchaseOdometer: v.purchaseOdometer,
    privateValue: v.lastPrivateValue, lastAppraisedAt: v.lastAppraisedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

export async function getVehicle(db: Db, id: string, today: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!v) throw notFound('Vehicle');
  return vehicleDto(v, today);
}

export async function updateVehicle(db: Db, v: Vehicle, patch: z.infer<typeof patchVehicleSchema>, today: string) {
  const set: Partial<typeof vehicles.$inferInsert> = { updatedAt: new Date() };
  if (patch.nickname !== undefined) set.nickname = patch.nickname;
  if (patch.zip !== undefined) set.zip = patch.zip;
  if (patch.trim !== undefined) {
    set.trim = resolveTrim(v.specs, patch.trim);
    set.modelKey = modelKey(v.specs.make, v.specs.model, set.trim);
  }
  if (patch.purchasePrice !== undefined) set.purchasePrice = patch.purchasePrice;
  if (patch.purchaseDate !== undefined) set.purchaseDate = patch.purchaseDate;
  if (patch.purchaseOdometer !== undefined) set.purchaseOdometer = patch.purchaseOdometer;
  const odo = patch.odometer ?? v.odometer;
  if (patch.odometer !== undefined && patch.odometer < v.odometer) {
    throw badRequest(
      `The odometer was already at ${v.odometer.toLocaleString('en-US')} mi. Odometer readings cannot go backwards.`,
      { odometer: ['Odometer readings cannot go backwards.'] },
    );
  }
  checkPurchase({ purchaseOdometer: set.purchaseOdometer ?? v.purchaseOdometer, purchaseDate: set.purchaseDate ?? v.purchaseDate }, odo, today);
  if (patch.odometer !== undefined && patch.odometer !== v.odometer) await recordOdometer(db, v.id, patch.odometer, today, 'manual', 'odometer');
  await db.update(vehicles).set(set).where(eq(vehicles.id, v.id));
  return getVehicle(db, v.id, today);
}

/* ----------------------------------------------------------- value change */

type ValueChange = { amount: number; sinceDate: string } | null;

/** Difference between the two newest appraisals of a vehicle (private value). */
export async function changeSinceLast(db: Db, vehicleId: string): Promise<ValueChange> {
  const rows = await db
    .select({ value: appraisals.privateValue, createdAt: appraisals.createdAt })
    .from(appraisals)
    .where(eq(appraisals.vehicleId, vehicleId))
    .orderBy(desc(appraisals.createdAt))
    .limit(2);
  if (rows.length < 2) return null;
  return { amount: rows[0]!.value.value - rows[1]!.value.value, sinceDate: rows[1]!.createdAt.toISOString().slice(0, 10) };
}

/* ---------------------------------------------------------------- garage */

export async function listGarage(db: Db, userId: string, today: string) {
  const list = await db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(vehicles.createdAt);
  let total = 0;
  let due = 0;
  const out = [];
  for (const v of list) {
    const items = await vehicleUpcoming(db, v, today);
    due += items.filter((i) => i.kind === 'date' && i.daysUntil <= 30).length;
    total += v.lastPrivateValue ?? 0;
    out.push({
      id: v.id, label: vehicleLabel(v), nickname: v.nickname, odometer: v.odometer, zip: v.zip, flags: vehicleFlags(v, today),
      privateValue: v.lastPrivateValue, lastAppraisedAt: v.lastAppraisedAt?.toISOString() ?? null,
      change: await changeSinceLast(db, v.id),
      nextService: nextServiceOf(items),
    });
  }
  return { vehicles: out, totals: { vehicles: list.length, totalPrivateValue: total, dueIn30Days: due } };
}

/* -------------------------------------------------------------- overview */

export async function vehicleOverview(db: Db, v: Vehicle, today: string) {
  const [items, change, apps, done, [recall], docs] = await Promise.all([
    vehicleUpcoming(db, v, today),
    changeSinceLast(db, v.id),
    db.select().from(appraisals).where(eq(appraisals.vehicleId, v.id)).orderBy(desc(appraisals.createdAt)),
    db.select().from(serviceEvents).where(and(eq(serviceEvents.vehicleId, v.id), eq(serviceEvents.status, 'done'))),
    db.select().from(recallChecks).where(eq(recallChecks.vehicleId, v.id)).orderBy(desc(recallChecks.checkedAt)).limit(1),
    documentsSummary(db, v.id, today),
  ]);

  type TimelineItem = { date: string; kind: 'appraisal' | 'service' | 'purchase'; id: string | null; title: string; detail: string; order: number; [k: string]: unknown };
  const timeline: TimelineItem[] = [];
  for (const a of apps) {
    const rev = revLetter(a.reportSeq);
    timeline.push({
      date: a.createdAt.toISOString().slice(0, 10), kind: 'appraisal', id: a.id, order: 0,
      title: rev ? `Appraisal, Rev ${rev}` : 'Appraisal', code: rev ? `Rev ${rev}` : null,
      privateValue: a.privateValue.value, detail: `${fmtUsd(a.privateValue.value)} private sale`,
    });
  }
  for (const e of done) {
    const detail = [e.costCents != null ? fmtCents(e.costCents) : null, e.shop].filter(Boolean).join(', ');
    timeline.push({
      date: e.date, kind: 'service', id: e.id, order: 1, title: e.title, type: e.type, costCents: e.costCents, shop: e.shop,
      odometer: e.odometer, detail,
    });
  }
  if (v.purchaseDate) {
    const detail = [v.purchasePrice != null ? fmtUsd(v.purchasePrice) : null, v.purchaseOdometer != null ? `${v.purchaseOdometer.toLocaleString('en-US')} mi` : null].filter(Boolean).join(', ');
    timeline.push({ date: v.purchaseDate, kind: 'purchase', id: null, order: 2, title: 'Purchased', price: v.purchasePrice, odometer: v.purchaseOdometer, detail });
  }
  timeline.sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order);

  const s = v.specs;
  // Facts we cannot verify, from the newest appraisal's answers, labeled "you reported".
  const latest = apps[0];
  const reportedKeys = latest?.confidence?.selfReported ?? ['condition', 'accidents', 'owners'];
  const reported = latest
    ? reportedKeys
        .filter((k): k is keyof typeof latest.inputs => k in latest.inputs)
        .map((k) => ({ key: k, value: latest.inputs[k], note: 'you reported' as const }))
    : [];
  return {
    vehicle: { id: v.id, label: vehicleLabel(v), nickname: v.nickname, vin: v.vin, odometer: v.odometer, zip: v.zip, flags: vehicleFlags(v, today) },
    specs: {
      engine: s.engine, drive: s.drive, body: s.body, fuel: s.fuel, doors: s.doors, plant: s.plant,
      decodeStatus: s.decodeStatus ?? null,
      /** decoded = vPIC trimRaw; value = the trim the user confirmed (null until they pick one). */
      trim: { value: v.trim, decoded: s.trimRaw, confirmed: v.trim !== null, text: v.trim ? `${v.trim} (you confirmed)` : s.trimRaw },
    },
    reported,
    privateValue: v.lastPrivateValue,
    lastAppraisedAt: v.lastAppraisedAt?.toISOString() ?? null,
    changeSinceLast: change,
    sincePurchase: v.purchasePrice != null && v.lastPrivateValue != null
      ? { amount: v.lastPrivateValue - v.purchasePrice, purchasePrice: v.purchasePrice }
      : null,
    nextService: nextServiceOf(items),
    openRecalls: recall ? { count: recall.results.length, checkedAt: recall.checkedAt.toISOString(), basis: recall.basis } : null,
    timeline: timeline.map(({ order: _o, ...t }) => t),
    documents: docs,
  };
}
