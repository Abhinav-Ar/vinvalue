import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createUser } from '../helpers/db';
import { fixtureProviders } from '../helpers/providers';
import type { Db } from '@/models/db';
import * as schema from '@/models/db/schema';
import { getMarket, takeMarketSnapshot } from '@/models/market/service';
import { checkMarketWatches, checkPriceWatches, createMarketWatch, createPriceWatch } from '@/models/watches/service';
import { getValueTracker } from '@/models/forecast/service';
import { getSellPlan } from '@/models/sell/service';
import { compareBuyChecks } from '@/models/buy/service';
import { countingListings, createAppraisal, createVehicle, MUSTANG_SPECS } from './helpers';

const KEY = { modelKey: 'ford|mustang|gt', zip: '60601', radiusMiles: 100 as const };
const agg = (medianPrice: number | null): schema.MarketAggregates => ({ count: 10, medianPrice, medianDaysOnMarket: 30, medianMiles: 40000, buckets: [] });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
}, 60000);

describe('market service', () => {
  it('first call snapshots via the provider, second call is served from cache', async () => {
    const { providers, counter } = countingListings(fixtureProviders());
    const a = await getMarket(db, providers, { ...KEY, today: '2026-11-12', yourValue: 27450 });
    expect(a.cached).toBe(false);
    expect(counter.calls).toBe(1);
    expect(a.activeListings).toBeGreaterThan(0);
    expect(a.medianAsking).toBeGreaterThan(0);
    expect(a.buckets).toHaveLength(6);
    expect(a.yourBucketIndex).not.toBeNull();
    expect(a.series12).toHaveLength(12);
    expect(a.series12[11]!.median).toBe(a.medianAsking);
    const b = await getMarket(db, providers, { ...KEY, today: '2026-11-12' });
    expect(b.cached).toBe(true);
    expect(counter.calls).toBe(1);
    expect(b.medianAsking).toBe(a.medianAsking);
    expect(b.yourBucketIndex).toBeNull();
  });

  it('priceChange90d against a stored snapshot ~90 days ago; series has gaps as null', async () => {
    await db.insert(schema.marketSnapshots).values({ ...KEY, snapshotDate: '2026-08-14', aggregates: agg(30000) });
    const m = await getMarket(db, fixtureProviders(), { ...KEY, today: '2026-11-12' });
    expect(m.priceChange90d).toBeCloseTo(((m.medianAsking! - 30000) / 30000) * 100, 0);
    expect(m.series12.find((s) => s.month === '2026-08')!.median).toBe(30000);
    expect(m.series12.find((s) => s.month === '2026-09')!.median).toBeNull();
  });

  it('takeMarketSnapshot upserts on the unique key', async () => {
    const p = fixtureProviders();
    await takeMarketSnapshot(db, p, { ...KEY, date: '2026-11-12' });
    await takeMarketSnapshot(db, p, { ...KEY, date: '2026-11-12' });
    const rows = await db.select().from(schema.marketSnapshots);
    expect(rows).toHaveLength(1);
  });
});

describe('watches', () => {
  it('price watch alerts once on crossing, dedupe key includes watch id and date', async () => {
    const u = await createUser(db);
    const v = await createVehicle(db, u.id, { lastPrivateValue: 27450 });
    const w = await createPriceWatch(db, u.id, { vehicleId: v.id, threshold: 26000, direction: 'below' });
    expect(w.lastValue).toBe(27450);
    expect(await checkPriceWatches(db, '2026-11-12')).toEqual([]);

    await db.update(schema.vehicles).set({ lastPrivateValue: 25900 }).where(eq(schema.vehicles.id, v.id));
    const d1 = await checkPriceWatches(db, '2026-11-13');
    expect(d1).toHaveLength(1);
    expect(d1[0]).toMatchObject({ userId: u.id, type: 'value', vehicleId: v.id, dedupeKey: `price:${w.id}:2026-11-13` });
    expect(d1[0]!.title).not.toMatch(/—/);
    // Still below: no repeat.
    await db.update(schema.vehicles).set({ lastPrivateValue: 25500 }).where(eq(schema.vehicles.id, v.id));
    expect(await checkPriceWatches(db, '2026-11-14')).toEqual([]);
    // Back above then below again: alerts again.
    await db.update(schema.vehicles).set({ lastPrivateValue: 26500 }).where(eq(schema.vehicles.id, v.id));
    expect(await checkPriceWatches(db, '2026-11-15')).toEqual([]);
    await db.update(schema.vehicles).set({ lastPrivateValue: 25000 }).where(eq(schema.vehicles.id, v.id));
    expect(await checkPriceWatches(db, '2026-11-16')).toHaveLength(1);
  });

  it('price watch on a saved buy check uses the stored verdict mid (above)', async () => {
    const u = await createUser(db);
    const [b] = await db.insert(schema.buyChecks).values({
      userId: u.id, vin: '1FA6P8CF9K5123456', specs: MUSTANG_SPECS, trim: 'GT', zip: '60601', askingPrice: 28900, mileage: 46100, sellerType: 'dealer',
      verdict: { fairLow: 28600, fairHigh: 31200, mid: 29900, verdict: 'fair', suggestedOffer: 28200, compCount: 20, computedAt: '2026-11-12' },
    }).returning();
    const w = await createPriceWatch(db, u.id, { buyCheckId: b!.id, threshold: 29000, direction: 'above' });
    // Created already crossed: stays quiet.
    expect(await checkPriceWatches(db, '2026-11-12')).toEqual([]);
    await db.update(schema.priceWatches).set({ lastValue: null }).where(eq(schema.priceWatches.id, w.id));
    const d = await checkPriceWatches(db, '2026-11-13');
    expect(d).toHaveLength(1);
    expect(d[0]!.type).toBe('price_target');
  });

  it('price watch ownership: someone else\'s vehicle is 404', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const v = await createVehicle(db, a.id);
    await expect(createPriceWatch(db, b.id, { vehicleId: v.id, threshold: 1, direction: 'below' })).rejects.toMatchObject({ status: 404 });
    await expect(createPriceWatch(db, a.id, { threshold: 1, direction: 'below' })).rejects.toMatchObject({ status: 400 });
  });

  it('market watch: sets baseline, alerts past threshold, resets baseline, dedupes per snapshot', async () => {
    const u = await createUser(db);
    const w = await createMarketWatch(db, u.id, { ...KEY, thresholdPct: 3 });
    expect(w.baselineMedian).toBeNull();
    await db.insert(schema.marketSnapshots).values({ ...KEY, snapshotDate: '2026-11-01', aggregates: agg(28000) });
    expect(await checkMarketWatches(db, '2026-11-01')).toEqual([]); // baseline set
    await db.insert(schema.marketSnapshots).values({ ...KEY, snapshotDate: '2026-11-05', aggregates: agg(27500) });
    expect(await checkMarketWatches(db, '2026-11-05')).toEqual([]); // -1.8%
    await db.insert(schema.marketSnapshots).values({ ...KEY, snapshotDate: '2026-11-10', aggregates: agg(27000) });
    const d = await checkMarketWatches(db, '2026-11-10'); // -3.6%
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ type: 'market', dedupeKey: `market:${w.id}:2026-11-10` });
    expect(d[0]!.title).toContain('down 3.6%');
    expect(await checkMarketWatches(db, '2026-11-10')).toEqual([]); // baseline reset to 27000
    // Future snapshots are ignored.
    await db.insert(schema.marketSnapshots).values({ ...KEY, snapshotDate: '2026-12-01', aggregates: agg(20000) });
    expect(await checkMarketWatches(db, '2026-11-11')).toEqual([]);
  });
});

describe('value tracker + sell plan services', () => {
  it('history, observed miles, forecast from latest value', async () => {
    const u = await createUser(db);
    const v = await createVehicle(db, u.id, { lastPrivateValue: 27450 });
    await createAppraisal(db, u.id, v.id, { privateValue: 28900, instantValue: 24300, createdAt: new Date('2026-01-10T12:00:00Z') });
    await createAppraisal(db, u.id, v.id, { privateValue: 27450, instantValue: 23100, createdAt: new Date('2026-11-01T12:00:00Z') });
    await db.insert(schema.odometerReadings).values([
      { vehicleId: v.id, miles: 33200, recordedOn: '2026-05-01', source: 'manual' },
      { vehicleId: v.id, miles: 38200, recordedOn: '2026-11-01', source: 'manual' },
    ]);
    const t = await getValueTracker(db, u.id, v.id, { today: '2026-11-12' });
    expect(t.history).toEqual([{ date: '2026-01-10', value: 28900 }, { date: '2026-11-01', value: 27450 }]);
    expect(t.milesPerYearSource).toBe('observed');
    expect(t.milesPerYear).toBe(9900);
    expect(t.forecast).toHaveLength(12);
    expect(t.forecast[0]!.month).toBe('2026-12');
    expect(t.seasonalitySource).toBe('default');
    const q = await getValueTracker(db, u.id, v.id, { today: '2026-11-12', milesPerYear: 30000 });
    expect(q.milesPerYearSource).toBe('query');
    expect(q.in12).toBeLessThan(t.in12);
  });

  it('no appraisal: 409; other user: 404', async () => {
    const u = await createUser(db);
    const other = await createUser(db);
    const v = await createVehicle(db, u.id);
    await expect(getValueTracker(db, u.id, v.id, { today: '2026-11-12' })).rejects.toMatchObject({ status: 409 });
    await expect(getValueTracker(db, other.id, v.id, { today: '2026-11-12' })).rejects.toMatchObject({ status: 404 });
    await expect(getSellPlan(db, other.id, v.id, { loanPayoff: 0 }, '2026-11-12')).rejects.toMatchObject({ status: 404 });
  });

  it('sell plan: IL ZIP is unsupported, CA override has rules; listing kit uses latest report', async () => {
    process.env.APP_URL = 'https://autoiq.test/';
    const u = await createUser(db);
    const v = await createVehicle(db, u.id, { lastPrivateValue: 27450 });
    await createAppraisal(db, u.id, v.id, { privateValue: 27450, instantValue: 23100, createdAt: new Date('2026-11-01T12:00:00Z'), slug: 'abc123' });
    await db.insert(schema.serviceEvents).values({ vehicleId: v.id, type: 'oil_filter', title: 'Oil change', date: '2026-06-01', status: 'done' });
    const il = await getSellPlan(db, u.id, v.id, { loanPayoff: 0 }, '2026-11-12');
    expect(il.state).toBe('IL');
    expect(il.stateRulesAvailable).toBe(false);
    expect(il.askingPrice).toBe(27450);
    expect(il.listingKit.reportLink).toBe('https://autoiq.test/r/abc123');
    expect(il.listingKit.descriptionDraft).toContain('Service records included.');
    const ca = await getSellPlan(db, u.id, v.id, { loanPayoff: 0, state: 'ca' }, '2026-11-12');
    expect(ca.stateRulesAvailable).toBe(true);
    expect(ca.routes.map((r) => r.net)).toEqual([23100, 22400, 27200]);
  });
});

describe('buy compare', () => {
  it('max 3 ids, own rows only', async () => {
    const u = await createUser(db);
    const other = await createUser(db);
    const mk = async (userId: string, askingPrice: number) => {
      const [b] = await db.insert(schema.buyChecks).values({
        userId, vin: '1FA6P8CF9K5123456', specs: MUSTANG_SPECS, trim: 'GT', zip: '60601', askingPrice, mileage: 46100, sellerType: 'dealer',
        verdict: { fairLow: 28600, fairHigh: 31200, mid: 29900, verdict: askingPrice > 31200 ? 'above' : 'fair', suggestedOffer: 28200, compCount: 20, computedAt: '2026-11-12' },
      }).returning();
      return b!.id;
    };
    const ids = [await mk(u.id, 28900), await mk(u.id, 31900), await mk(u.id, 29000), await mk(u.id, 30000)];
    const rows = await compareBuyChecks(db, u.id, ids.slice(0, 3));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ car: '2019 Mustang GT', miles: 46100, asking: 31900, seller: 'dealer', verdict: 'above', verdictLabel: 'High' });
    await expect(compareBuyChecks(db, u.id, ids)).rejects.toMatchObject({ status: 400 });
    const foreign = await mk(other.id, 28000);
    await expect(compareBuyChecks(db, u.id, [ids[0]!, foreign])).rejects.toMatchObject({ status: 404 });
  });
});

describe('value tracker seasonality source', () => {
  it('uses market seasonality when 12 monthly snapshots exist for the model', async () => {
    const u = await createUser(db);
    const v = await createVehicle(db, u.id, { lastPrivateValue: 27450 });
    const months = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    await db.insert(schema.marketSnapshots).values(months.map((m, i) => ({ ...KEY, snapshotDate: `${m}-01`, aggregates: agg(29000 - i * 100 + (i % 3) * 200) })));
    const t = await getValueTracker(db, u.id, v.id, { today: '2026-11-12' });
    expect(t.seasonalitySource).toBe('market');
    expect(t.forecast).toHaveLength(12);
  });
});
