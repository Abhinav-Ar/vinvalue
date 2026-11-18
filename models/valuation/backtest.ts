/**
 * Leave-one-out backtest (pure). Each eligible listing in turn becomes the subject (its year, trim,
 * miles; neutral answers: good, clean, no accidents) and is valued from the others with the same
 * engine. Error is measured against the listing's private-equivalent price (dealer asks x
 * (1 + dealerToPrivatePct)), since the engine predicts a private sale value.
 */
import type { DecodedSpecs } from '@/models/db/schema';
import type { Listing } from '@/models/providers/types';
import { TooFewCompsError } from '@/models/errors';
import { median } from '@/models/stats';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
import { computeLegacyValuation as computeValuation, eligibleListings } from './index';

export type BacktestResult = {
  /** Listings that could be predicted (others had >= minComps usable). */
  predicted: number;
  skipped: number;
  /** Median absolute percentage error, in percent (e.g. 6.2). Null when nothing was predicted. */
  medianApePct: number | null;
  errors: { id: string; actual: number; predicted: number; apePct: number }[];
};

export function backtest(
  listings: Listing[],
  opts: { make: string; model: string; zip?: string; config?: ValuationConfig; searchTier?: number } ,
): BacktestResult {
  const config = opts.config ?? valuationConfig;
  const pool = eligibleListings(listings).listings;
  const errors: BacktestResult['errors'] = [];
  let skipped = 0;
  pool.forEach((subject, i) => {
    const others = pool.filter((_, j) => j !== i);
    const specs: DecodedSpecs = {
      year: subject.year, make: opts.make, model: opts.model, trimRaw: subject.trim, trimCandidates: subject.trim ? [subject.trim] : [],
      body: null, drive: null, engine: null, fuel: null, doors: null, plant: null, checkDigitValid: true, decodeStatus: 'clean',
    };
    try {
      const r = computeValuation({
        specs,
        listings: others,
        config,
        searchTier: opts.searchTier ?? 1,
        trimConfirmedByUser: true,
        inputs: {
          vin: 'BACKTEST', trim: subject.trim, mileage: subject.miles, zip: opts.zip ?? '00000',
          condition: 'good', title: 'clean', accidents: 'none', serviceHistory: null, owners: null, keys: null, warningLights: null,
        },
      });
      const actual = subject.sellerType === 'private' ? subject.price : subject.price * (1 + config.dealerToPrivatePct);
      const apePct = (Math.abs(r.private.value - actual) / actual) * 100;
      errors.push({ id: subject.id, actual: Math.round(actual), predicted: r.private.value, apePct: Math.round(apePct * 100) / 100 });
    } catch (e) {
      if (e instanceof TooFewCompsError) skipped++;
      else throw e;
    }
  });
  return {
    predicted: errors.length,
    skipped,
    medianApePct: errors.length ? Math.round(median(errors.map((e) => e.apePct)) * 100) / 100 : null,
    errors,
  };
}
