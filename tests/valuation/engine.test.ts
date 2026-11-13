import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeValuation, compWeight, eligibleListings, pricableCount, normalizeTrim, outlierFlags, trimsMatch, weightLabel, weightedQuantile, wlsSlope,
} from '@/lib/valuation';
import { fetchComps, fetchCompsTiered } from '@/lib/valuation/comps';
import { backtest } from '@/lib/valuation/backtest';
import { buildReport } from '@/lib/appraisals/report';
import { mapListing } from '@/lib/providers/marketcheck';
import { valuationConfig as C, type ValuationConfig } from '@/config/valuation';
import { TooFewCompsError, UpstreamError } from '@/lib/errors';
import { fixtureProviders } from '../helpers/providers';
import type { AppraisalInputs, DecodedSpecs } from '@/lib/db/schema';
import type { Listing, ListingQuery, Providers } from '@/lib/providers/types';

const specs: DecodedSpecs = {
  year: 2019, make: 'Ford', model: 'Mustang', trimRaw: 'GT Coupe', trimCandidates: ['GT'],
  body: 'Coupe', drive: 'RWD', engine: '5.0L V8', fuel: 'Gasoline', doors: 2, plant: null, checkDigitValid: true, decodeStatus: 'clean',
};

const inputs = (over: Partial<AppraisalInputs> = {}): AppraisalInputs => ({
  vin: '1FA6P8CF9K5123456', trim: 'GT', mileage: 50000, zip: '60601',
  condition: 'good', title: 'clean', accidents: 'none',
  serviceHistory: null, owners: null, keys: null, warningLights: null, ...over,
});

let n = 0;
/** Default comp: private seller (prices used as-is), same miles/year/trim as the subject, fresh, local. */
const listing = (over: Partial<Listing> = {}): Listing => ({
  id: `l${n++}`, vin: null, inventoryType: 'used', price: 20000, miles: 50000, distance: 10, year: 2019, make: 'Ford', model: 'Mustang',
  trim: 'GT', sellerType: 'private', daysOnMarket: 20, ...over,
});
const flat = (prices: number[], over: Partial<Listing> = {}) => prices.map((price) => listing({ price, ...over }));
const PRICES = [19000, 19500, 20000, 20000, 20000, 20500, 21000, 20000, 19800, 20200];
const cfg = (over: Record<string, unknown>): ValuationConfig => ({ ...C, ...over }) as ValuationConfig;
const adj = (r: ReturnType<typeof computeValuation>, key: string) => r.adjustments.find((a) => a.key === key)!;
const r10 = (x: number) => Math.round(x / 10) * 10;

describe('trims, weights, eligibility', () => {
  it('normalizes trims loosely but keeps sub-trims distinct', () => {
    expect(normalizeTrim('GT Coupe')).toBe('gt');
    expect(trimsMatch('gt', 'GT')).toBe(true);
    expect(trimsMatch('GT', 'GT Premium')).toBe(false);
    expect(trimsMatch('3.0 Premium', '3.0  premium')).toBe(true);
  });

  it('weight = mileage closeness x year x stale x trim-adjusted, from config', () => {
    const s = { miles: 50000, year: 2019 };
    const c = { miles: 50000, year: 2019, daysOnMarket: 10 };
    expect(compWeight(c, s)).toBe(1);
    expect(compWeight({ ...c, miles: 50000 + C.mileageWeightScale }, s)).toBeCloseTo(0.5);
    expect(compWeight({ ...c, year: 2018 }, s)).toBeCloseTo(C.otherYearWeight);
    expect(compWeight({ ...c, year: 2021 }, s)).toBeCloseTo(C.otherYearWeight ** 2);
    expect(compWeight({ ...c, daysOnMarket: C.staleDomDays }, s)).toBeCloseTo(C.staleWeight);
    expect(compWeight(c, s, 'adjusted')).toBeCloseTo(C.trimAdjustedWeight);
    expect(compWeight(c, s, 'excluded')).toBe(0);
    expect(compWeight(c, s, 'adjusted', cfg({ trimAdjustedWeight: 0.2 }))).toBeCloseTo(0.2);
  });

  it('labels weights', () => {
    expect([weightLabel(0.9), weightLabel(0.5), weightLabel(0.2)]).toEqual(['High', 'Med', 'Low']);
  });

  it('dedupes by VIN keeping the closest, drops certified inventory', () => {
    const a = listing({ vin: 'X'.repeat(17), distance: 50 });
    const b = listing({ vin: 'X'.repeat(17), distance: 10 });
    const cpo = listing({ inventoryType: 'certified' });
    const e = eligibleListings([a, b, cpo, listing()]);
    expect(e.listings).toEqual([b, e.listings[1]]);
    expect(e).toMatchObject({ duplicatesRemoved: 1, certifiedRemoved: 1 });
    const r = computeValuation({ specs, inputs: inputs(), listings: [...flat(Array(10).fill(20000)), a, b, cpo] });
    expect(r.stats.duplicatesRemoved).toBe(1);
    expect(r.comps).toHaveLength(11);
    expect(r.methodNotes.join(' ')).toMatch(/1 duplicate listing/);
  });

  it('stats helpers', () => {
    expect(weightedQuantile([{ value: 1, weight: 1 }, { value: 2, weight: 1 }, { value: 3, weight: 2 }], 0.75)).toBe(3);
    expect(wlsSlope([{ x: 0, y: 10, w: 1 }, { x: 10, y: 0, w: 1 }])).toBeCloseTo(-1);
    expect(wlsSlope([{ x: 5, y: 10, w: 1 }, { x: 5, y: 0, w: 1 }])).toBeNull();
  });
});

describe('trim gap', () => {
  it('shifts other-trim comps by the median gap when both sides have enough data', () => {
    const ls = [...flat(Array(8).fill(20000)), ...flat([23000, 23000, 23000, 23000], { trim: 'GT Premium' })];
    const r = computeValuation({ specs, inputs: inputs(), listings: ls });
    const prem = r.comps.filter((c) => c.trim === 'GT Premium');
    expect(prem.every((c) => c.trimMatch === 'adjusted' && c.adjustedPrice === 20000)).toBe(true);
    expect(prem[0]!.weight).toBeCloseTo(C.trimAdjustedWeight);
    expect(r.stats.used).toBe(12);
    expect(r.stats.weightedMedian).toBe(20000);
    expect(r.methodNotes.join(' ')).toMatch(/GT Premium listings shifted by -\$3,000 to match GT/);
  });

  it('excludes other-trim comps when the gap cannot be priced', () => {
    const ls = [...flat(Array(8).fill(20000)), ...flat([30000, 30000], { trim: 'GT Premium' })];
    const r = computeValuation({ specs, inputs: inputs(), listings: ls });
    expect(r.comps.filter((c) => c.trimMatch === 'excluded')).toHaveLength(C.trimGapMinPerSide - 1);
    expect(r.stats.used).toBe(8);
    expect(r.stats.weightedMedian).toBe(20000);
  });

  it('treats all comps alike when the subject trim is unknown, and widens the range', () => {
    const ls = [...flat(Array(8).fill(20000)), ...flat(Array(8).fill(30000), { trim: 'GT Premium' })];
    const r = computeValuation({ specs, inputs: inputs({ trim: null }), listings: ls });
    expect(r.comps.every((c) => c.trimMatch === 'exact')).toBe(true);
    expect(r.stats.weightedMedian).toBe(25000);
    expect(r.confidence.trimConfirmedByUser).toBe(false);
    expect(r.confidence.rangeReasons).toContain('Trim not confirmed.');
  });
});

describe('private vs dealer base', () => {
  it('uses private-seller comps when there are enough', () => {
    const ls = [...flat([18500, 18500, 18500, 18500, 18500]), ...flat(Array(10).fill(22000), { sellerType: 'dealer' })];
    const r = computeValuation({ specs, inputs: inputs(), listings: ls });
    expect(r.stats).toMatchObject({ privateComps: 5, dealerComps: 10, weightedMedian: 18500 });
    expect(r.comps.filter((c) => c.usedInBase).every((c) => c.sellerType === 'private')).toBe(true);
    expect(r.methodNotes).toContain('Private sale value based on 5 private-seller listings.');
    // Report label counts the private subset, not every used comp.
    const row = { id: 'a', userId: null, vehicleId: null, shareSlug: 's', reportSeq: null, inputs: inputs(), specs, privateValue: r.private,
      instantValue: r.instant, retailValue: r.retail, adjustments: r.adjustments, compStats: r.stats, route: 'private' as const,
      methodVersion: r.methodVersion, confidence: r.confidence, expiresAt: null, createdAt: new Date(0) };
    expect(buildReport(row, [], null).base.label).toBe('Weighted median of 5 private-seller listings');
  });

  it('converts dealer asks with dealerToPrivatePct when private comps are few', () => {
    const r = computeValuation({ specs, inputs: inputs(), listings: flat(Array(10).fill(20000), { sellerType: 'dealer' }) });
    expect(r.stats.weightedMedian).toBe(r10(20000 * (1 + C.dealerToPrivatePct)));
    expect(r.stats.privateComps).toBe(0);
    expect(r.methodNotes.join(' ')).toMatch(/converted to private-sale equivalents/);
    const r2 = computeValuation({ specs, inputs: inputs(), listings: flat(Array(10).fill(20000), { sellerType: 'dealer' }), config: cfg({ dealerToPrivatePct: -0.2 }) });
    expect(r2.stats.weightedMedian).toBe(16000);
  });
});

describe('outliers, base, too few', () => {
  it('flags prices outside 1.5 x IQR and keeps them in output', () => {
    expect(outlierFlags([10, 11, 12, 13, 14, 100], 1.5)).toEqual([false, false, false, false, false, true]);
    expect(outlierFlags([1, 2, 100], 1.5)).toEqual([false, false, false]);
    const r = computeValuation({ specs, inputs: inputs(), listings: [...flat(PRICES), listing({ price: 60000 }), listing({ price: 5000 })] });
    expect(r.comps).toHaveLength(12);
    expect(r.comps.filter((c) => c.excludedAsOutlier).map((c) => c.price).sort()).toEqual([5000, 60000]);
    expect(r.stats).toMatchObject({ found: 12, used: 10, excluded: 2 });
    expect(r.methodNotes[0]).toBe('2 listings removed as price outliers.');
  });

  it('base is the weighted median of the remaining comps', () => {
    expect(computeValuation({ specs, inputs: inputs(), listings: flat(PRICES) }).stats.weightedMedian).toBe(20000);
    const ls = [...flat(Array(5).fill(18000)), ...flat(Array(5).fill(26000), { miles: 110000 })];
    const r = computeValuation({ specs, inputs: inputs(), listings: ls });
    expect(r.stats.weightedMedian).toBe(18000);
    expect(r.stats.median).toBe(22000);
  });

  it('throws TooFewCompsError with the usable count', () => {
    const ls = flat(PRICES.slice(0, 5));
    expect(() => computeValuation({ specs, inputs: inputs(), listings: ls })).toThrow(TooFewCompsError);
    expect(() => computeValuation({ specs, inputs: inputs(), listings: ls })).toThrow(
      expect.objectContaining({ status: 404, code: 'too_few_comps', compCount: 5, minComps: C.minComps }),
    );
    expect(() => computeValuation({ specs, inputs: inputs(), listings: [] })).toThrow(TooFewCompsError);
  });

  it('sparse fixture: 3 usable comps after every search tier -> compCount 3', async () => {
    const lotus: DecodedSpecs = { ...specs, year: 2023, make: 'Lotus', model: 'Emira', trimCandidates: ['V6'] };
    const { listings, searchTier } = await fetchCompsTiered(fixtureProviders(), { specs: lotus, trim: 'V6', zip: '60601' });
    expect(searchTier).toBe(3);
    expect(() => computeValuation({ specs: lotus, inputs: inputs({ trim: 'V6' }), listings, searchTier })).toThrow(
      expect.objectContaining({ compCount: 3 }),
    );
  });
});

describe('adjustments', () => {
  const base = 20000;

  it('orders lines and always includes regional, condition, accidents and title', () => {
    const r = computeValuation({ specs, inputs: inputs(), listings: flat(PRICES) });
    expect(r.adjustments.map((a) => a.key)).toEqual(['mileage', 'regional', 'condition', 'accidents', 'title']);
    expect(r.adjustments.map((a) => a.label)).toEqual([
      'Mileage, 50,000 vs 50,000 average', 'Regional demand, 60601', 'Condition, good', 'Accident history, none reported', 'Title, clean',
    ]);
    expect(r.adjustments.every((a) => a.amount === 0)).toBe(true);
    expect(r.private.value).toBe(base);
  });

  it('mileage falls back to mileagePctPer1k without mileage spread', () => {
    const r = computeValuation({ specs, inputs: inputs({ mileage: 40000 }), listings: flat(PRICES) });
    expect(adj(r, 'mileage').amount).toBe(r10(base * C.mileagePctPer1k * 10));
    expect(adj(r, 'mileage').reason).toMatch(/standard rate/);
    const r2 = computeValuation({ specs, inputs: inputs({ mileage: 40000 }), listings: flat(PRICES), config: cfg({ mileagePctPer1k: 0.01 }) });
    expect(adj(r2, 'mileage').amount).toBe(2000);
  });

  it('mileage uses the weighted least-squares slope when the fit is reliable', () => {
    // price = 30000 - 0.1 x miles exactly, miles 20k..74k.
    const ls = Array.from({ length: 10 }, (_, i) => listing({ miles: 20000 + i * 6000, price: 30000 - 0.1 * (20000 + i * 6000) }));
    const r = computeValuation({ specs, inputs: inputs({ mileage: 30000 }), listings: ls });
    const expected = r10(-0.1 * (30000 - r.stats.avgMiles));
    expect(adj(r, 'mileage').amount).toBe(expected);
    expect(adj(r, 'mileage').reason).toMatch(/fitted from 10 comparable listings/);
    // A positive slope is not trusted.
    const up = Array.from({ length: 10 }, (_, i) => listing({ miles: 20000 + i * 6000, price: 18000 + 0.05 * (20000 + i * 6000) }));
    expect(adj(computeValuation({ specs, inputs: inputs({ mileage: 30000 }), listings: up }), 'mileage').reason).toMatch(/standard rate/);
  });

  it('mileage adjustment is capped', () => {
    const r = computeValuation({ specs, inputs: inputs({ mileage: 0 }), listings: flat(PRICES, { miles: 150000 }) });
    expect(adj(r, 'mileage').amount).toBe(base * C.mileageAdjCapPct);
    const r2 = computeValuation({ specs, inputs: inputs({ mileage: 400000 }), listings: flat(PRICES) });
    expect(adj(r2, 'mileage').amount).toBe(-base * C.mileageAdjCapPct);
  });

  it('regional demand is $0 at tier 1 and local vs wide median (capped) at tier 2+', () => {
    const t1 = computeValuation({ specs, inputs: inputs(), listings: flat(PRICES) });
    expect(adj(t1, 'regional')).toMatchObject({ amount: 0, reason: 'Comps are local, so local demand is already in the price.' });
    const ls = [...flat(Array(5).fill(21000), { distance: 20 }), ...flat(Array(5).fill(19000), { distance: 200 })];
    const t2 = computeValuation({ specs, inputs: inputs(), listings: ls, searchTier: 2 });
    expect(t2.stats.weightedMedian).toBe(20000);
    expect(adj(t2, 'regional').amount).toBe(base * C.regionalCapPct); // 21000/20000 - 1 = 5%, at the cap
    expect(t2.stats.radiusMiles).toBe(C.widenedRadiusMiles);
    const farOnly = computeValuation({ specs, inputs: inputs(), listings: flat(PRICES, { distance: 200 }), searchTier: 2 });
    expect(adj(farOnly, 'regional')).toMatchObject({ amount: 0 });
    expect(adj(farOnly, 'regional').reason).toMatch(/too few listings are local/);
  });

  it('condition, accidents, title use config fractions', () => {
    const r = computeValuation({ specs, inputs: inputs({ condition: 'rough', accidents: 'major', title: 'rebuilt' }), listings: flat(PRICES) });
    expect(adj(r, 'condition')).toMatchObject({ label: 'Condition, rough', amount: base * C.condition.rough });
    expect(adj(r, 'accidents')).toMatchObject({ label: 'Accident history, major', amount: base * C.accidents.major });
    expect(adj(r, 'title')).toMatchObject({ label: 'Title, rebuilt', amount: base * C.title.rebuilt });
    expect(adj(computeValuation({ specs, inputs: inputs({ condition: 'excellent' }), listings: flat(PRICES) }), 'condition').amount).toBe(base * C.condition.excellent);
  });

  it('optional lines appear only when answered', () => {
    const r = computeValuation({
      specs, listings: flat(PRICES),
      inputs: inputs({ serviceHistory: 'full', owners: 3, keys: 'one', warningLights: 'check_engine' }),
    });
    expect(r.adjustments.map((a) => a.key)).toEqual(['mileage', 'regional', 'condition', 'accidents', 'title', 'serviceHistory', 'owners', 'keys', 'warningLights']);
    expect(adj(r, 'serviceHistory').amount).toBe(base * C.serviceHistory.full);
    expect(adj(r, 'owners').amount).toBe(base * C.owners[3]);
    expect(adj(r, 'keys').amount).toBe(base * C.keys.one);
    expect(adj(r, 'warningLights')).toMatchObject({ amount: base * C.warningLights.check_engine, label: 'Warning lights, check engine' });
    expect(r.private.value).toBe(base + r.adjustments.reduce((a, x) => a + x.amount, 0));
    expect(r.confidence.selfReported).toEqual(['condition', 'accidents', 'title', 'owners', 'keys', 'warningLights', 'serviceHistory']);
  });

  it('private value is floored at a fraction of base', () => {
    const r = computeValuation({
      specs, listings: flat(PRICES),
      inputs: inputs({ mileage: 400000, condition: 'rough', title: 'salvage', accidents: 'major', serviceHistory: 'none', owners: 3, keys: 'one', warningLights: 'check_engine' }),
      config: cfg({ title: { clean: 0, rebuilt: -0.25, salvage: -0.8 } }),
    });
    expect(r.private.value).toBe(base * C.floorPct);
    expect(r.private.low).toBeGreaterThan(0);
  });
});

describe('ranges, spreads, confidence', () => {
  const twenty = flat(Array(20).fill(20000));
  const baseHalf = Math.min(C.rangeMaxPct, Math.max(C.rangeMinPct, C.rangeSelfReportedConditionPct + C.rangeNoTitleDataPct));

  it('range from weighted IQR plus configured widenings; spreads from config', () => {
    const r = computeValuation({ specs, inputs: inputs(), listings: twenty });
    expect(r.private).toEqual({ value: 20000, low: r10(20000 * (1 - baseHalf)), high: r10(20000 * (1 + baseHalf)) });
    expect(r.instant.value).toBe(r10(20000 * (1 + C.spreads.instant)));
    expect(r.retail.value).toBe(r10(20000 * (1 + C.spreads.retail)));
    expect(r.instant.low).toBe(r10(20000 * (1 - baseHalf) * (1 + C.spreads.instant)));
    expect(r.confidence.rangeReasons).toEqual(['Condition is self-reported.', 'Title and accident history are not verified by a history report.']);

    const r2 = computeValuation({ specs, inputs: inputs(), listings: twenty, config: cfg({ spreads: { instant: -0.3, retail: 0.25 }, rangeMinPct: 0.1 }) });
    expect(r2.instant.value).toBe(14000);
    expect(r2.retail.value).toBe(25000);
    expect(r2.private.low).toBe(18000);
  });

  it('widens for few comps, search tier and unconfirmed trim; clamps at rangeMaxPct', () => {
    const width = (r: ReturnType<typeof computeValuation>) => r.private.high - r.private.low;
    const ref = computeValuation({ specs, inputs: inputs(), listings: twenty, config: cfg({ rangeMinPct: 0 }) });
    const few = computeValuation({ specs, inputs: inputs(), listings: flat(Array(8).fill(20000)), config: cfg({ rangeMinPct: 0 }) });
    expect(width(few)).toBe(width(ref) + 2 * 20000 * C.rangeFewCompsPct);
    expect(few.confidence.rangeReasons[0]).toBe('Only 8 comparable listings were usable.');
    const t3 = computeValuation({ specs, inputs: inputs(), listings: twenty, searchTier: 3, config: cfg({ rangeMinPct: 0 }) });
    expect(width(t3)).toBeCloseTo(width(ref) + 2 * 20000 * C.tierRangePct[3]!, -1);
    expect(t3.confidence.searchTier).toBe(3);
    const wide = computeValuation({ specs, inputs: inputs(), listings: flat([10000, 14000, 18000, 20000, 22000, 26000, 30000, 34000]) });
    expect(wide.private.high).toBe(r10(wide.private.value * (1 + C.rangeMaxPct)));
  });

  it('confidence block: decode status and mileage-for-age flag', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    const r = computeValuation({ specs: { ...specs, decodeStatus: 'partial' }, inputs: inputs({ mileage: 250000 }), listings: flat(PRICES), now });
    expect(r.confidence).toMatchObject({ decodeStatus: 'partial', trimConfirmedByUser: true, flags: ['mileage_high_for_age'], searchTier: 1 });
    expect(computeValuation({ specs, inputs: inputs(), listings: flat(PRICES), now }).confidence.flags).toEqual([]);
    expect(r.methodVersion).toBe(C.methodVersion);
  });

  it('rounds to config.roundTo and is deterministic', () => {
    const ls = flat([19990, 20010, 20020, 20040, 19970, 20080, 19930, 20000, 20050, 19960]);
    const a = computeValuation({ specs, inputs: inputs({ mileage: 43210 }), listings: ls, config: cfg({ roundTo: 100 }), now: new Date(0) });
    const b = computeValuation({ specs, inputs: inputs({ mileage: 43210 }), listings: ls, config: cfg({ roundTo: 100 }), now: new Date(0) });
    expect(a).toEqual(b);
    for (const v of [a.private, a.instant, a.retail]) for (const x of Object.values(v)) expect(x % 100).toBe(0);
  });
});

describe('fetchComps tiers', () => {
  const calls: ListingQuery[] = [];
  const spy = (inner: Providers): Providers => ({
    ...inner,
    listings: { searchActive: async (q) => { calls.push(q); return inner.listings.searchActive(q); } },
  });

  it('tier 1 with a single confirmed trim', async () => {
    calls.length = 0;
    const r = await fetchCompsTiered(spy(fixtureProviders()), { specs, trim: 'GT', zip: '60601' });
    expect(r.searchTier).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ trim: 'GT', yearFrom: 2018, yearTo: 2020, radiusMiles: C.radiusMiles, maxResults: C.maxComps });
    expect(r.listings.every((l) => l.trim === 'GT')).toBe(true);
  });

  it('drops the trim filter when trim-filtered results are too few', async () => {
    calls.length = 0;
    const ls = await fetchComps(spy(fixtureProviders()), { specs, trim: 'GT Premium', zip: '60601', config: cfg({ minComps: 10 }) });
    expect(calls.map((c) => c.trim ?? null)).toEqual(['GT Premium', null]);
    expect(ls.length).toBeGreaterThan(20);
  });

  it('widens radius then years when thin', async () => {
    calls.length = 0;
    const lotus: DecodedSpecs = { ...specs, year: 2023, make: 'Lotus', model: 'Emira' };
    await fetchCompsTiered(spy(fixtureProviders()), { specs: lotus, trim: null, zip: '60601' });
    expect(calls.map((c) => [c.radiusMiles, c.yearFrom, c.yearTo])).toEqual([
      [C.radiusMiles, 2022, 2024], [C.widenedRadiusMiles, 2022, 2024], [C.widenedRadiusMiles, 2021, 2025],
    ]);
  });

  it('widens when other-trim listings would be excluded (trim-aware count)', async () => {
    // Tier 1: 5 exact + 10 singleton other trims (all excluded by the engine). Tier 2: plenty of exact.
    const t1 = [...flat(Array(5).fill(20000)), ...Array.from({ length: 10 }, (_, i) => listing({ trim: "Other " + i }))];
    expect(pricableCount(t1, 'GT')).toBe(5);
    expect(pricableCount(t1, null)).toBe(15);
    const wide = flat(Array(12).fill(20000), { distance: 200 });
    const p: Providers = { ...fixtureProviders(), listings: { searchActive: async (q) => ({ numFound: 0, listings: q.radiusMiles > C.radiusMiles ? wide : t1 }) } };
    const r = await fetchCompsTiered(p, { specs, trim: 'GT', zip: '60601' });
    expect(r.searchTier).toBe(2);
  });

  it('never sends slash trims and propagates upstream errors', async () => {
    calls.length = 0;
    await fetchComps(spy(fixtureProviders()), { specs, trim: 'L/LE', zip: '60601' });
    expect(calls[0]!.trim ?? null).toBeNull();
    await expect(fetchComps(fixtureProviders({ listingsFailure: { status: 429 } }), { specs, trim: 'GT', zip: '60601' })).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('backtest gate (leave-one-out)', () => {
  const dir = join(process.cwd(), 'tests', 'fixtures', 'marketcheck');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('error_'));
  for (const f of files) {
    const listings = (JSON.parse(readFileSync(join(dir, f), 'utf8')).listings as Record<string, unknown>[])
      .map(mapListing).filter((l): l is Listing => !!l);
    const gated = eligibleListings(listings).listings.length > C.minComps;
    it(`${f} ${gated ? `median APE <= ${C.backtestMaxMedianApePct}%` : 'is too small to gate'}`, () => {
      const r = backtest(listings, { make: listings[0]!.make, model: listings[0]!.model });
      if (!gated) return expect(r.predicted).toBe(0);
      expect(r.predicted).toBeGreaterThan(C.minComps);
      expect(r.medianApePct!).toBeLessThanOrEqual(C.backtestMaxMedianApePct);
    });
  }
});
