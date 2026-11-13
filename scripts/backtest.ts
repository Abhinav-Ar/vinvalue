/**
 * Leave-one-out backtest over every MarketCheck fixture. Run: npx tsx scripts/backtest.ts
 * Prints a table; exits 1 if any fixture with >= minComps listings breaks backtestMaxMedianApePct.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mapListing } from '../src/lib/providers/marketcheck';
import { backtest } from '../src/lib/valuation/backtest';
import { eligibleListings } from '../src/lib/valuation';
import { valuationConfig } from '../src/config/valuation';
import type { Listing } from '../src/lib/providers/types';

const dir = join(process.cwd(), 'tests', 'fixtures', 'marketcheck');
let failed = false;
console.log(['fixture', 'listings', 'predicted', 'skipped', 'median APE %', 'gate'].join('\t'));
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('error_'))) {
  const body = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const listings = (body.listings as Record<string, unknown>[]).map(mapListing).filter((l): l is Listing => !!l);
  const first = listings[0];
  if (!first) continue;
  const r = backtest(listings, { make: first.make, model: first.model });
  const gated = eligibleListings(listings).listings.length > valuationConfig.minComps;
  const ok = !gated || (r.medianApePct ?? Infinity) <= valuationConfig.backtestMaxMedianApePct;
  if (!ok) failed = true;
  console.log([f, listings.length, r.predicted, r.skipped, r.medianApePct ?? '-', gated ? (ok ? 'pass' : 'FAIL') : 'n/a'].join('\t'));
}
process.exit(failed ? 1 : 0);
