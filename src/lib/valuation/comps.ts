import type { DecodedSpecs } from '@/lib/db/schema';
import type { Listing, ListingQuery, Providers } from '@/lib/providers/types';
import { valuationConfig, type ValuationConfig } from '@/config/valuation';
import { pricableCount } from './index';

export type FetchCompsArgs = {
  specs: DecodedSpecs;
  /** Confirmed trim. Sent to the provider only when it is a single value (no "L/LE" lists). */
  trim: string | null;
  zip: string;
  /** Local (tier 1) radius. Default config.radiusMiles. */
  radiusMiles?: number;
  config?: ValuationConfig;
};

export type TieredComps = { listings: Listing[]; searchTier: 1 | 2 | 3 };

/**
 * Search tiers, stopping at the first with >= minComps pricable listings (eligible, and not in an
 * other-trim group the engine would exclude):
 *   1: year +-yearSpread within radiusMiles (trim-filtered first when a single trim is confirmed,
 *      then unfiltered so the engine can price the trim gap)
 *   2: year +-yearSpread within widenedRadiusMiles
 *   3: year +-(yearSpread + 1) within widenedRadiusMiles
 * Returns the last tier tried even if still short (the engine raises too_few_comps with the count).
 * Provider errors (UpstreamError, not_configured) propagate untouched.
 */
export async function fetchCompsTiered(providers: Providers, args: FetchCompsArgs): Promise<TieredComps> {
  const config = args.config ?? valuationConfig;
  const radius = args.radiusMiles ?? config.radiusMiles;
  const q = (spread: number, radiusMiles: number, trim: string | null): ListingQuery => ({
    make: args.specs.make,
    model: args.specs.model,
    yearFrom: args.specs.year - spread,
    yearTo: args.specs.year + spread,
    zip: args.zip,
    radiusMiles,
    maxResults: config.maxComps,
    trim,
  });
  const trim = args.trim && !args.trim.includes('/') ? args.trim.trim() : null;
  // Trim-aware: other-trim listings the engine would exclude do not count toward 'enough'.
  const enough = (ls: Listing[]) => pricableCount(ls, trim, config) >= config.minComps;
  if (trim) {
    const r = await providers.listings.searchActive(q(config.yearSpread, radius, trim));
    if (enough(r.listings)) return { listings: r.listings, searchTier: 1 };
  }
  const t1 = await providers.listings.searchActive(q(config.yearSpread, radius, null));
  if (enough(t1.listings)) return { listings: t1.listings, searchTier: 1 };
  const t2 = await providers.listings.searchActive(q(config.yearSpread, config.widenedRadiusMiles, null));
  if (enough(t2.listings)) return { listings: t2.listings, searchTier: 2 };
  const t3 = await providers.listings.searchActive(q(config.yearSpread + 1, config.widenedRadiusMiles, null));
  return { listings: t3.listings, searchTier: 3 };
}

/** Contract signature: listings only. Prefer fetchCompsTiered and pass searchTier to computeValuation. */
export async function fetchComps(providers: Providers, args: FetchCompsArgs): Promise<Listing[]> {
  return (await fetchCompsTiered(providers, args)).listings;
}
