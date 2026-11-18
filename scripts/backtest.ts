/**
 * Leave-one-out backtest over every MarketCheck fixture. Run: npx tsx scripts/backtest.ts
 * Prints a table; exits 1 if any fixture with >= minComps listings breaks backtestMaxMedianApePct.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { mapListing } from '../models/providers/marketcheck';
import { backtest } from '../models/valuation/backtest';
import { eligibleListings } from '../models/valuation';
import { valuationConfig } from '../models/config/valuation';
import type { Listing } from '../models/providers/types';

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
  const coverage = r.predicted / eligibleListings(listings).listings.length;
  const ok = !gated || ((r.medianApePct ?? Infinity) <= valuationConfig.backtestMaxMedianApePct && coverage >= valuationConfig.backtestMinCoverage);
  if (!ok) failed = true;
  console.log([f, listings.length, r.predicted, r.skipped, r.medianApePct ?? '-', gated ? (ok ? 'pass' : 'FAIL') : 'n/a'].join('\t'));
}

const { scoreSales } = await import('../models/valuation/calibration');
const { loadReferences } = await import('../models/reference');
console.log('MODEL MODE: arithmetic examples, not accuracy labels');
console.table(workedExamples());
console.log('Labeled model backtest (no tuning):', scoreSales(JSON.parse(readFileSync(process.argv.includes('--labels') ? process.argv[process.argv.indexOf('--labels')+1]! : join(process.cwd(),'tests/fixtures/reference/labeled-sales.json'),'utf8')),loadReferences()));
process.exit(failed ? 1 : 0);

import { exampleReference, examples } from '../tests/fixtures/reference/factory';
import { evaluateSurface } from '../models/valuation/surface';

/** Illustrative mechanics, NEVER accuracy labels. Exceptional Supra override is a sensitivity
 * scenario, not a production parameter: no out-of-time validated family evidence exists yet. */
function workedExamples() {
 return examples.map((e,i)=>{
   const data=exampleReference(i), specs={...e,transmission:e.D?'manual':'automatic'};
   const cfg=i===6?{...valuationConfig,generationCurvePriors:{'toyota/supra turbo/fixture':{onset:12,onsetRetention:.8,growthCap:4,growth:.04,sourceUrls:['https://example.com/HYPOTHETICAL-evidence']}}}:valuationConfig;
   const conservative=evaluateSurface(specs,'Base',e.miles,new Date('2026-11-16Z'),data);
   const revised=evaluateSurface(specs,'Base',e.miles,new Date('2026-11-16Z'),data,cfg);
   return {subject:e.model,before:e.before,after:Math.round(revised.H/10)*10,conservative:Math.round(conservative.H/10)*10,target:null,label:i===6?'hypothetical evidenced override; production remains conservative':'arithmetic illustration; not labeled sale'};
 });
}
