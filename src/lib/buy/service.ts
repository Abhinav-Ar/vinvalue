/**
 * Price check (providers) + saved buy checks (DB).
 *
 * Provider calls per price check: 1 vPIC decode (cached in vin_decodes), fetchCompsTiered (MarketCheck pages, up to 3 search tiers), 1 NHTSA recalls.
 * Error semantics match appraisals: 400 invalid input or trim required (trimCandidates in the body),
 * 404 too_few_comps, 422 vin_not_decoded, 502 upstream_failed, 503 not_configured.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { buyChecks, priceWatches, type AppraisalInputs, type BuyVerdict, type Confidence, type DecodedSpecs } from '@/lib/db/schema';
import { decodeVin } from '@/lib/vin-decode';
import type { Providers } from '@/lib/providers/types';
import { computeValuation } from '@/lib/valuation';
import { fetchCompsTiered } from '@/lib/valuation/comps';
import { trimRequiredError } from '@/lib/appraisals/service';
import { badRequest, notFound } from '@/lib/errors';
import { caSmog } from '@/config/states/ca';
import { stateFromZip } from '@/config/states';
import { log } from '@/lib/log';
import { buildVerdict, buyConfig, SELLER_QUESTIONS, VERDICT_TEXT } from './verdict';

export type PriceCheckInput = {
  vin: string;
  askingPrice: number;
  mileage: number;
  sellerType: 'dealer' | 'private';
  zip: string;
  trim?: string | null;
  /** Imported / grey-market: check digit mismatch becomes a warning instead of a 400. */
  importedVehicle?: boolean;
};

export type BuyChecklistItem = { key: string; title: string; detail: string; count?: number | null };

export type PriceCheckResult = {
  vehicle: { year: number; make: string; model: string; trim: string | null; body: string | null; engine: string | null; drive: string | null; fuel: string | null };
  askingPrice: number;
  mileage: number;
  sellerType: 'dealer' | 'private';
  fairRange: { low: number; high: number; mid: number; basis: 'retail' | 'private' };
  verdict: BuyVerdict['verdict'];
  verdictLabel: string;
  verdictNote: string;
  suggestedFirstOffer: number;
  compCount: number;
  /** Engine confidence block (decodeStatus, rangeReasons, searchTier, ...). */
  confidence: Confidence;
  warnings: string[];
  checklist: BuyChecklistItem[];
  questions: string[];
  /** Exactly what POST /api/buy-checks stores. */
  snapshot: BuyVerdict;
};

function specsOnly(d: DecodedSpecs & { vin?: string; warnings?: string[]; raw?: unknown }): DecodedSpecs {
  const { vin: _v, warnings: _w, raw: _r, ...rest } = d as DecodedSpecs & { vin?: string; warnings?: string[]; raw?: unknown };
  return rest;
}

export async function runPriceCheck(
  db: Db,
  providers: Providers,
  input: PriceCheckInput,
  today: string,
): Promise<{ result: PriceCheckResult; specs: DecodedSpecs; trim: string | null }> {
  const decoded = await decodeVin(db, providers, input.vin, { importedVehicle: input.importedVehicle });
  const specs = specsOnly(decoded);
  let trim = input.trim?.trim() || null;
  const trimConfirmedByUser = !!trim;
  if (!trim) {
    if (specs.trimCandidates.length === 1) trim = specs.trimCandidates[0]!;
    else if (specs.trimCandidates.length > 1) throw trimRequiredError(specs.trimCandidates);
  }
  const inputs: AppraisalInputs = {
    vin: input.vin, trim, mileage: input.mileage, zip: input.zip,
    condition: 'good', title: 'clean', accidents: 'none',
    serviceHistory: null, owners: null, keys: null, warningLights: null,
  };
  const { listings, searchTier } = await fetchCompsTiered(providers, { specs, trim, zip: input.zip });
  const val = computeValuation({ specs, inputs, listings, searchTier, trimConfirmedByUser, now: new Date(`${today}T12:00:00Z`) });
  const snapshot = buildVerdict({
    askingPrice: input.askingPrice,
    sellerType: input.sellerType,
    privateRange: val.private,
    retailRange: val.retail,
    compCount: val.stats.used,
    computedAt: today,
  });

  const confidence = val.confidence;

  let recallCount: number | null = null;
  try {
    recallCount = (await providers.recalls.byModelYear(specs.make, specs.model, specs.year)).length;
  } catch (err) {
    log.warn('price_check.recalls_failed', { err });
  }
  const checklist: BuyChecklistItem[] = [
    {
      key: 'recalls',
      title: 'Recall check',
      count: recallCount,
      detail: recallCount == null
        ? 'We could not reach NHTSA just now. Check the VIN at nhtsa.gov/recalls.'
        : `${recallCount} recall${recallCount === 1 ? '' : 's'} may apply to this model year (NHTSA, by model year, not this VIN). Ask the seller for proof the work was done, or check the VIN at nhtsa.gov/recalls.`,
    },
    {
      key: 'title_history',
      title: 'Title history',
      // TODO(data source): NMVTIS-approved title history provider.
      detail: 'Salvage, flood or odometer brands are not checked yet. Get a title history report before you pay.',
    },
  ];
  if (stateFromZip(input.zip) === 'CA') {
    const smog = caSmog({ modelYear: specs.year, fuel: specs.fuel, today });
    checklist.push({
      key: 'smog',
      title: 'Smog certificate',
      detail: smog.required ? 'In California the seller provides it for gas cars over four model years old. Ask to see it; it is good for 90 days.' : smog.note,
    });
  }
  checklist.push({ key: 'inspection', title: 'Pre-purchase inspection', detail: 'Book an independent mechanic before you pay.' });

  const text = VERDICT_TEXT[snapshot.verdict];
  return {
    specs,
    trim,
    result: {
      vehicle: { year: specs.year, make: specs.make, model: specs.model, trim, body: specs.body, engine: specs.engine, drive: specs.drive, fuel: specs.fuel },
      askingPrice: input.askingPrice,
      mileage: input.mileage,
      sellerType: input.sellerType,
      fairRange: { low: snapshot.fairLow, high: snapshot.fairHigh, mid: snapshot.mid, basis: input.sellerType === 'dealer' ? 'retail' : 'private' },
      verdict: snapshot.verdict,
      verdictLabel: text.label,
      verdictNote: text.note,
      suggestedFirstOffer: snapshot.suggestedOffer,
      compCount: snapshot.compCount,
      confidence,
      warnings: decoded.warnings,
      checklist,
      questions: [...SELLER_QUESTIONS],
      snapshot,
    },
  };
}

export type BuyCheckRow = typeof buyChecks.$inferSelect;

export function buyCheckView(b: BuyCheckRow) {
  return {
    id: b.id,
    label: [b.specs.year, b.specs.model, b.trim].filter(Boolean).join(' '),
    year: b.specs.year, make: b.specs.make, model: b.specs.model, trim: b.trim,
    vin: b.vin,
    askingPrice: b.askingPrice,
    mileage: b.mileage,
    sellerType: b.sellerType,
    verdict: b.verdict,
    createdAt: b.createdAt.toISOString(),
  };
}

export async function saveBuyCheck(db: Db, providers: Providers, userId: string, input: PriceCheckInput, today: string) {
  const { result, specs, trim } = await runPriceCheck(db, providers, input, today);
  const [row] = await db
    .insert(buyChecks)
    .values({
      userId, vin: input.vin, specs, trim, zip: input.zip,
      askingPrice: input.askingPrice, mileage: input.mileage, sellerType: input.sellerType,
      verdict: result.snapshot,
    })
    .returning();
  return { buyCheck: buyCheckView(row!), result };
}

export async function listBuyChecks(db: Db, userId: string) {
  const rows = await db.select().from(buyChecks).where(eq(buyChecks.userId, userId)).orderBy(desc(buyChecks.createdAt));
  return rows.map(buyCheckView);
}

export async function deleteBuyCheck(db: Db, userId: string, id: string) {
  const r = await db.delete(buyChecks).where(and(eq(buyChecks.id, id), eq(buyChecks.userId, userId))).returning({ id: buyChecks.id });
  if (!r.length) throw notFound('Saved price check');
}

export const VERDICT_SHORT: Record<BuyVerdict['verdict'], string> = { below: 'Low', fair: 'Fair', above: 'High' };

export async function compareBuyChecks(db: Db, userId: string, ids: string[]) {
  const uniq = [...new Set(ids)];
  if (!uniq.length || uniq.length > buyConfig.compareMax) {
    throw badRequest(`Compare 1 to ${buyConfig.compareMax} saved cars.`, { ids: [`Pick up to ${buyConfig.compareMax} saved cars.`] });
  }
  const rows = await db.select().from(buyChecks).where(and(eq(buyChecks.userId, userId), inArray(buyChecks.id, uniq)));
  if (rows.length !== uniq.length) throw notFound('Saved price check');
  const byId = new Map(rows.map((r) => [r.id, r]));
  return uniq.map((id) => {
    const b = byId.get(id)!;
    return {
      id: b.id,
      car: [b.specs.year, b.specs.model, b.trim].filter(Boolean).join(' '),
      miles: b.mileage,
      asking: b.askingPrice,
      seller: b.sellerType,
      verdict: b.verdict.verdict,
      verdictLabel: VERDICT_SHORT[b.verdict.verdict],
      fairLow: b.verdict.fairLow,
      fairHigh: b.verdict.fairHigh,
    };
  });
}

/**
 * Re-value saved buy checks that have a price watch, so checkPriceWatches sees fresh numbers.
 * Keeps the stored asking price and seller type; rewrites buy_checks.verdict (computedAt = today).
 * Call before checkPriceWatches (daily or weekly). Cost per watched check: fetchCompsTiered
 * (MarketCheck pages, up to 3 tiers); no vPIC call (stored specs). Errors are per check, never abort the batch.
 */
export async function revalueWatchedBuyChecks(
  db: Db,
  providers: Providers,
  today: string,
): Promise<{ updated: number; failed: number }> {
  const watched = await db.selectDistinct({ id: priceWatches.buyCheckId }).from(priceWatches);
  const ids = watched.map((w) => w.id).filter((x): x is string => !!x);
  if (!ids.length) return { updated: 0, failed: 0 };
  const rows = await db.select().from(buyChecks).where(inArray(buyChecks.id, ids));
  let updated = 0;
  let failed = 0;
  for (const b of rows) {
    try {
      const inputs: AppraisalInputs = {
        vin: b.vin, trim: b.trim, mileage: b.mileage, zip: b.zip,
        condition: 'good', title: 'clean', accidents: 'none',
        serviceHistory: null, owners: null, keys: null, warningLights: null,
      };
      const { listings, searchTier } = await fetchCompsTiered(providers, { specs: b.specs, trim: b.trim, zip: b.zip });
      const val = computeValuation({ specs: b.specs, inputs, listings, searchTier, trimConfirmedByUser: !!b.trim, now: new Date(`${today}T12:00:00Z`) });
      const verdict = buildVerdict({
        askingPrice: b.askingPrice, sellerType: b.sellerType,
        privateRange: val.private, retailRange: val.retail, compCount: val.stats.used, computedAt: today,
      });
      await db.update(buyChecks).set({ verdict }).where(eq(buyChecks.id, b.id));
      updated++;
    } catch (err) {
      failed++;
      log.warn('buy_check.revalue_failed', { buyCheckId: b.id, err });
    }
  }
  return { updated, failed };
}
