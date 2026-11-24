import { readCorrections } from '@/models/jobs/valuationCalibration';
/**
 * Appraisal service: decode -> comps -> engine -> persist. All provider work and
 * the engine run BEFORE any write, so a failed appraisal never burns a report
 * number. Writes happen in one transaction.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { appraisals, comps as compsTable, odometerReadings, saleOutcomes, users, vehicles } from '@/models/db/schema';
import type { AppraisalInputs, DecodedSpecs } from '@/models/db/schema';
import type { Providers } from '@/models/providers/types';
import { AppError, TooFewCompsError, badRequest, conflict, notFound, unauthorized } from '@/models/errors';
import { requireVehicle } from '@/models/ownership';
import { valuationConfig } from '@/models/config/valuation';
import { computeValuation } from '@/models/valuation';
import { fetchCompsTiered } from '@/models/valuation/comps';
import { loadEnrichments } from '@/models/providers/enrichment';
import { decodeVin } from '@/models/vin-decode';
import { buildReport, type AppraisalReport } from './report';

export type Appraisal = typeof appraisals.$inferSelect;
export type SaleRoute = Appraisal['route'];
export type { AppraisalReport, PublicReport } from './report';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 0 -> "AQ-10A", 25 -> "AQ-10Z", 26 -> "AQ-11A". */
export function reportCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) throw new Error(`bad report seq ${seq}`);
  return `AQ-${10 + Math.floor(seq / 26)}${LETTERS[seq % 26]}`;
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 10-char random base62 (rejection sampling, no modulo bias). */
export function newShareSlug(len = 10): string {
  let out = '';
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < 248 && out.length < len) out += BASE62[b % 62];
    }
  }
  return out;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Strip decoder-only fields (vin, warnings, raw vPIC row) before storing specs. */
function specsOnly(d: DecodedSpecs & { vin?: string; warnings?: string[]; raw?: unknown }): DecodedSpecs {
  const { vin: _v, warnings: _w, raw: _r, ...rest } = d;
  return rest;
}

/** 400 asking the UI to pick a trim. Candidates ride along in the error body. */
export function trimRequiredError(candidates: string[]) {
  return new AppError(400, 'invalid_input', 'Pick your trim. This VIN matches more than one.', { trim: ['Choose a trim.'] }, { trimCandidates: candidates });
}

export type AppraiseArgs = {
  userId: string | null;
  vehicleId?: string | null;
  inputs: AppraisalInputs;
  route?: SaleRoute;
  /** Imported / grey-market: a check digit mismatch is a warning instead of a 400. */
  importedVehicle?: boolean;
  /** Set when the trim came from a saved vehicle the user confirmed (refresh). Default: inputs.trim was given. */
  trimConfirmedByUser?: boolean;
  /** Skip the vPIC call when specs are already known (refresh). */
  specs?: DecodedSpecs;
  /** Refresh path: never ask for a trim; no trim filter when unknown. */
  allowUnknownTrim?: boolean;
  /** Record an odometer reading for the vehicle (user-entered mileage). Default true. */
  recordOdometer?: boolean;
  now?: Date;
};

export async function appraiseAndSave(db: Db, providers: Providers, args: AppraiseArgs): Promise<AppraisalReport> {
  const now = args.now ?? new Date();
  const config = valuationConfig;

  // Ownership first (cheap, and avoids paid upstream calls for bad requests).
  let vehicle: typeof vehicles.$inferSelect | null = null;
  if (args.vehicleId) {
    if (!args.userId) throw unauthorized();
    vehicle = await requireVehicle(db, args.userId, args.vehicleId);
    if (vehicle.vin !== args.inputs.vin) throw badRequest('Some fields are invalid.', { vin: ['This VIN does not match the selected vehicle.'] });
  }

  const specs = args.specs ? specsOnly(args.specs) : specsOnly(await decodeVin(db, providers, args.inputs.vin, { importedVehicle: args.importedVehicle, now }));

  let trim = args.inputs.trim?.trim() || null;
  if (!trim) {
    if (specs.trimCandidates.length === 1) trim = specs.trimCandidates[0]!;
    else if (specs.trimCandidates.length > 1 && !args.allowUnknownTrim) throw trimRequiredError(specs.trimCandidates);
  } else if (specs.trimCandidates.length > 0 && !args.allowUnknownTrim) {
    // In model mode the trim selects the MSRP anchor, so a trim the VIN contradicts (e.g. "Shelby GT500"
    // on a GT VIN) would silently price a different car. Ask the user to pick one the VIN supports.
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!specs.trimCandidates.some((c) => norm(c) === norm(trim!))) {
      throw new AppError(400, 'invalid_input', "That trim doesn't match this VIN. Pick one of the trims it decodes to.", { trim: ['Choose a trim this VIN supports.'] }, { trimCandidates: specs.trimCandidates });
    }
  }
  const inputs: AppraisalInputs = { ...args.inputs, trim };

  const trimConfirmedByUser = args.trimConfirmedByUser ?? !!args.inputs.trim?.trim();
  let compsSearch: Awaited<ReturnType<typeof fetchCompsTiered>> | null = null;
  const corrections=await readCorrections(db);
  let result: ReturnType<typeof computeValuation>;
  try {
    compsSearch = await fetchCompsTiered(providers, { specs, trim, zip: inputs.zip, radiusMiles: config.radiusMiles });
    const { listings, searchTier } = compsSearch;
    result = computeValuation({ specs, inputs, corrections, listings, radiusMiles: config.radiusMiles, searchTier, trimConfirmedByUser, now });
    result.stats.comparisonBasis = compsSearch.comparisonBasis; result.stats.searchStages = compsSearch.searchStages;
  } catch (err) {
    if (!(err instanceof TooFewCompsError) && !(err instanceof AppError && ['not_configured', 'upstream_failed'].includes(err.code))) throw err;
    result = computeValuation({ specs, inputs, corrections, listings: [], trimConfirmedByUser, now });
  }

  const id = await db.transaction(async (tx) => {
    let reportSeq: number | null = null;
    if (args.userId) {
      const [u] = await tx
        .update(users)
        .set({ nextReportSeq: sql`${users.nextReportSeq} + 1` })
        .where(eq(users.id, args.userId))
        .returning({ next: users.nextReportSeq });
      if (!u) throw unauthorized();
      reportSeq = u.next - 1;
    }
    // Odometer never goes backwards: only record a reading at or above the latest one (by date, then
    // miles; vehicles.odometer when there are no readings). Otherwise skip it and flag the report.
    let writeReading = false;
    if (vehicle && args.recordOdometer !== false) {
      const [last] = await tx
        .select({ miles: odometerReadings.miles })
        .from(odometerReadings)
        .where(eq(odometerReadings.vehicleId, vehicle.id))
        .orderBy(desc(odometerReadings.recordedOn), desc(odometerReadings.miles))
        .limit(1);
      const floor = last?.miles ?? vehicle.odometer;
      writeReading = inputs.mileage >= floor;
      if (!writeReading && !result.confidence.flags.includes('mileage_below_last_reading')) {
        result.confidence.flags.push('mileage_below_last_reading');
      }
    }
    const enrichment = await loadEnrichments(providers.enrichment, specs, inputs.vin, now);
    const [row] = await tx
      .insert(appraisals)
      .values({
        userId: args.userId,
        vehicleId: vehicle?.id ?? null,
        shareSlug: newShareSlug(),
        reportSeq,
        inputs,
        specs,
        privateValue: result.private,
        instantValue: result.instant,
        retailValue: result.retail,
        adjustments: result.adjustments,
        compStats: result.stats,
        route: args.route ?? 'private',
        methodVersion: result.methodVersion,
        confidence: result.confidence,
        enrichment,
        expiresAt: args.userId ? null : new Date(now.getTime() + config.anonymousRetentionDays * 86_400_000),
        createdAt: now,
      })
      .returning({ id: appraisals.id });
    const appraisalId = row!.id;
    if (result.comps.length) {
      await tx.insert(compsTable).values(
        result.comps.map((c) => ({
          appraisalId,
          listingId: c.id || 'unknown',
          price: c.price,
          miles: c.miles,
          distanceMiles: c.distance,
          year: c.year,
          trim: c.trim,
          sellerType: c.sellerType,
          daysOnMarket: c.daysOnMarket,
          weight: c.weight,
          excludedAsOutlier: c.excludedAsOutlier,
          trimMatch: c.trimMatch,
          adjustedPrice: c.adjustedPrice,
          searchTier: c.searchTier,
          title: c.title ?? null, dealerName: c.dealerName ?? null, dealerCity: c.dealerCity ?? null, vdpUrl: c.vdpUrl ?? null, photos: c.photos ?? [],
        })),
      );
    }
    if (vehicle) {
      await tx
        .update(vehicles)
        .set({
          lastPrivateValue: result.private.value,
          lastAppraisedAt: now,
          odometer: Math.max(vehicle.odometer, inputs.mileage),
          updatedAt: now,
        })
        .where(eq(vehicles.id, vehicle.id));
      if (writeReading) {
        await tx.insert(odometerReadings).values({ vehicleId: vehicle.id, miles: inputs.mileage, recordedOn: isoDate(now), source: 'appraisal' });
      }
    }
    return appraisalId;
  });

  const report = await loadReportById(db, id);
  return report!;
}

/**
 * Re-value a garage vehicle with its stored specs/zip/trim and current odometer,
 * reusing the answers from its latest appraisal (defaults: good / clean / none).
 * Used by the weekly job; never asks for a trim and never writes an odometer reading.
 */
export async function refreshVehicleValue(db: Db, providers: Providers, vehicleId: string, now?: Date): Promise<AppraisalReport> {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v) throw notFound('Vehicle');
  const last = await latestAppraisal(db, vehicleId);
  const li = last?.inputs;
  const inputs: AppraisalInputs = {
    vin: v.vin,
    trim: v.trim ?? li?.trim ?? null,
    mileage: v.odometer,
    zip: v.zip,
    condition: li?.condition ?? 'good',
    title: li?.title ?? 'clean',
    accidents: li?.accidents ?? 'none',
    serviceHistory: li?.serviceHistory ?? null,
    owners: li?.owners ?? null,
    keys: li?.keys ?? null,
    warningLights: li?.warningLights ?? null,
  };
  return appraiseAndSave(db, providers, {
    userId: v.userId,
    vehicleId: v.id,
    inputs,
    route: last?.route ?? 'private',
    specs: v.specs,
    trimConfirmedByUser: v.trim != null,
    allowUnknownTrim: true,
    recordOdometer: false,
    now,
  });
}

export async function latestAppraisal(db: Db, vehicleId: string): Promise<Appraisal | null> {
  const [a] = await db
    .select()
    .from(appraisals)
    .where(eq(appraisals.vehicleId, vehicleId))
    .orderBy(desc(appraisals.createdAt), desc(appraisals.reportSeq))
    .limit(1);
  return a ?? null;
}

/** Deletes anonymous appraisals (and their comps, by cascade) past expiresAt. */
export async function purgeExpiredAnonymousAppraisals(db: Db, now: Date): Promise<number> {
  const rows = await db
    .delete(appraisals)
    .where(and(isNull(appraisals.userId), isNotNull(appraisals.expiresAt), lt(appraisals.expiresAt, now)))
    .returning({ id: appraisals.id });
  return rows.length;
}

async function loadReport(db: Db, a: Appraisal | undefined): Promise<AppraisalReport | null> {
  if (!a) return null;
  const rows = await db.select().from(compsTable).where(eq(compsTable.appraisalId, a.id)).orderBy(asc(compsTable.id));
  return buildReport(a, rows, a.reportSeq != null ? reportCode(a.reportSeq) : null);
}

export async function loadReportById(db: Db, id: string): Promise<AppraisalReport | null> {
  const [a] = await db.select().from(appraisals).where(eq(appraisals.id, id)).limit(1);
  return loadReport(db, a);
}

/** Public lookup by share slug. Null when missing or expired. */
export async function loadReportBySlug(db: Db, slug: string, now = new Date()): Promise<AppraisalReport | null> {
  const [a] = await db.select().from(appraisals).where(eq(appraisals.shareSlug, slug)).limit(1);
  if (!a || (a.expiresAt && a.expiresAt.getTime() <= now.getTime())) return null;
  return loadReport(db, a);
}

/**
 * Attach an anonymous report to a signed-in user: assigns the next report
 * number and clears the expiry. Idempotent for the same user; 409 if owned by
 * someone else; 404 if missing or expired.
 */
export async function claimReport(db: Db, userId: string, slug: string, now = new Date()): Promise<AppraisalReport> {
  const id = await db.transaction(async (tx) => {
    const [a] = await tx.select().from(appraisals).where(eq(appraisals.shareSlug, slug)).limit(1);
    if (!a || (a.expiresAt && a.expiresAt.getTime() <= now.getTime())) throw notFound('Report');
    if (a.userId === userId) return a.id;
    if (a.userId) throw conflict('This report is already saved to another account.');
    const [u] = await tx
      .update(users)
      .set({ nextReportSeq: sql`${users.nextReportSeq} + 1` })
      .where(eq(users.id, userId))
      .returning({ next: users.nextReportSeq });
    if (!u) throw unauthorized();
    const [claimed] = await tx
      .update(appraisals)
      .set({ userId, reportSeq: u.next - 1, expiresAt: null })
      .where(and(eq(appraisals.id, a.id), isNull(appraisals.userId)))
      .returning({ id: appraisals.id });
    if (!claimed) throw conflict('This report is already saved to another account.');
    return claimed.id;
  });
  return (await loadReportById(db, id))!;
}

export type ActivityItem = {
  id: string;
  code: string | null;
  createdAt: string;
  vehicle: string;
  vehicleId: string | null;
  route: SaleRoute;
  value: number;
  /** Difference vs the previous appraisal of the same vehicle (same VIN); null means "New". */
  change: number | null;
  shareSlug: string;
};

/** Value shown for a route. "trade" has no column of its own and uses the instant value. */
export function routeValue(a: Pick<Appraisal, 'route' | 'privateValue' | 'instantValue' | 'retailValue'>, route = a.route): number {
  if (route === 'retail') return a.retailValue.value;
  if (route === 'instant' || route === 'trade') return a.instantValue.value;
  return a.privateValue.value;
}

/** Activity page: the user's appraisals, newest first. */
export async function listAppraisals(db: Db, userId: string, opts: { vehicleId?: string } = {}): Promise<ActivityItem[]> {
  const where = opts.vehicleId
    ? and(eq(appraisals.userId, userId), eq(appraisals.vehicleId, opts.vehicleId))
    : eq(appraisals.userId, userId);
  const rows = await db.select().from(appraisals).where(where).orderBy(desc(appraisals.createdAt), desc(appraisals.reportSeq));
  return rows.map((a, i) => {
    const prev = rows.slice(i + 1).find((p) => (a.vehicleId && p.vehicleId === a.vehicleId) || p.inputs.vin === a.inputs.vin);
    const value = routeValue(a);
    return {
      id: a.id,
      code: a.reportSeq != null ? reportCode(a.reportSeq) : null,
      createdAt: isoDate(a.createdAt),
      vehicle: vehicleLabel(a.specs, a.inputs.trim),
      vehicleId: a.vehicleId,
      route: a.route,
      value,
      change: prev ? value - routeValue(prev, a.route) : null,
      shareSlug: a.shareSlug,
    };
  });
}

export function vehicleLabel(specs: Pick<DecodedSpecs, 'year' | 'make' | 'model'>, trim: string | null): string {
  return [specs.year, specs.make, specs.model, trim].filter(Boolean).join(' ');
}

export type SaleOutcomeInput = { soldPrice: number; route: SaleRoute; soldOn: string };

/**
 * Record what the car actually sold for (calibration data for spreads and the
 * asking-to-sale discount). One outcome per vehicle: a second call replaces it.
 * Appraisals without a vehicle get one outcome per appraisal.
 */
export async function recordSaleOutcome(db: Db, userId: string, appraisalId: string, input: SaleOutcomeInput) {
  const [a] = await db.select().from(appraisals).where(and(eq(appraisals.id, appraisalId), eq(appraisals.userId, userId))).limit(1);
  if (!a) throw notFound('Appraisal');
  const values = { userId, vehicleId: a.vehicleId, appraisalId: a.id, ...input };
  if (a.vehicleId) {
    const [row] = await db
      .insert(saleOutcomes)
      .values(values)
      .onConflictDoUpdate({ target: saleOutcomes.vehicleId, set: { appraisalId: a.id, soldPrice: input.soldPrice, route: input.route, soldOn: input.soldOn } })
      .returning();
    return row!;
  }
  await db.delete(saleOutcomes).where(and(eq(saleOutcomes.appraisalId, a.id), eq(saleOutcomes.userId, userId)));
  const [row] = await db.insert(saleOutcomes).values(values).returning();
  return row!;
}
