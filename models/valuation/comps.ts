import type { DecodedSpecs } from '@/models/db/schema';
import type { Listing, ListingQuery, Providers } from '@/models/providers/types';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
import { pricableCount } from './index';
import { resolveZipState } from '@/models/market/state';
import { AppError } from '@/models/errors';

export type FetchCompsArgs = { specs: DecodedSpecs; trim: string | null; zip: string; radiusMiles?: number; config?: ValuationConfig; budgetMs?: number };
export type SearchStage = { name: string; status: 'ok' | 'failed' | 'skipped'; found: number; elapsedMs: number; query?: Partial<ListingQuery>; error?: string };
export type TieredComps = { listings: Listing[]; searchTier: 1 | 2 | 3; comparisonBasis?: 'local' | 'state' | 'newest-year'; searchStages?: SearchStage[] };

const unique = (ls: Listing[]) => { const seen = new Set<string>(); return ls.filter(l => { const k = l.vin || l.id; if (!k || seen.has(k)) return false; seen.add(k); return l.price >= 2000; }); };

/** Free-tier staged search. Requests are sequential to honor the total seven-second budget. */
export async function fetchCompsTiered(providers: Providers, args: FetchCompsArgs): Promise<TieredComps> {
  const config = args.config ?? valuationConfig; const started = Date.now(); const budget = args.budgetMs ?? 7000;
  const radius = args.radiusMiles ?? config.radiusMiles; const trim = args.trim && !args.trim.includes('/') ? args.trim.trim() : null;
  const stages: SearchStage[] = []; let collected: Listing[] = []; let tier: 1|2|3 = 1; let basis: TieredComps['comparisonBasis'] = 'local';
  const run = async (name: string, query: ListingQuery, stageTier: 1|2|3, stageBasis: TieredComps['comparisonBasis'] = 'local') => {
    if (Date.now() - started >= budget) { stages.push({ name, status: 'skipped', found: 0, elapsedMs: 0, query }); return null; }
    const t = Date.now(); try { const r = await Promise.race([providers.listings.searchActive(query), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('search budget exceeded')), Math.min(3500, Math.max(1, budget - (Date.now()-started))))) ]); collected = unique([...collected, ...r.listings]); stages.push({ name, status: 'ok', found: r.listings.length, elapsedMs: Date.now()-t, query }); tier = stageTier; basis = stageBasis; return r; }
    catch (e) { if (e instanceof AppError) throw e; /* not_configured, quota and auth failures stay explicit; only timeouts/transient failures are tolerated */ stages.push({ name, status: 'failed', found: 0, elapsedMs: Date.now()-t, query, error: e instanceof Error ? e.message : 'failed' }); return null; }
  };
  const q = (spread:number, r:number|undefined, t?:string|null, extra: Partial<ListingQuery> = {}): ListingQuery => ({ make: args.specs.make, model: args.specs.model, yearFrom: args.specs.year-spread, yearTo: args.specs.year+spread, zip: args.zip, radiusMiles:r ?? 0, maxResults: config.maxComps, trim:t, ...extra });
  const enough = () => pricableCount(collected, trim, config) >= config.minComps;
  if (trim) { await run('exact-year-trim-local', q(config.yearSpread, radius, trim), 1); if (enough()) return { listings: collected, searchTier:tier, comparisonBasis:basis, searchStages:stages }; }
  await run('exact-year-local', q(config.yearSpread, radius, null), 1); if (enough()) return { listings: collected, searchTier:tier, comparisonBasis:basis, searchStages:stages };
  await run('exact-year-wide', q(config.yearSpread, config.widenedRadiusMiles, null), 2); if (enough()) return { listings: collected, searchTier:tier, comparisonBasis:basis, searchStages:stages };
  await run('adjacent-years-wide', q(config.yearSpread + 1, config.widenedRadiusMiles, null), 3); if (enough()) return { listings: collected, searchTier:tier, comparisonBasis:basis, searchStages:stages };
  const state = await resolveZipState(args.zip);
  if (state) {
    await run('exact-year-state', q(0, undefined, null, { zip: '', radiusMiles: 0, state }), 2, 'state');
    if (enough()) return { listings: collected, searchTier:2, comparisonBasis:'state', searchStages:stages };
    await run('adjacent-years-state', q(config.yearSpread, undefined, null, { zip: '', radiusMiles: 0, state }), 3, 'state');
    if (enough()) return { listings: collected, searchTier:3, comparisonBasis:'state', searchStages:stages };
  } else stages.push({ name:'state-resolution', status:'failed', found:0, elapsedMs:0, error:'state unavailable' });
  if (args.specs.year >= new Date().getFullYear()-1) {
    await run('newest-year-new-inventory', q(0, config.widenedRadiusMiles, null, { inventoryType:'new' }), 3, 'newest-year');
  }
  return { listings: collected, searchTier:tier, comparisonBasis:basis, searchStages:stages };
}
export async function fetchComps(providers: Providers, args: FetchCompsArgs): Promise<Listing[]> { return (await fetchCompsTiered(providers,args)).listings; }
