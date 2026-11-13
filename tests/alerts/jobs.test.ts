import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/appraisals/service', () => ({
  refreshVehicleValue: vi.fn(),
  purgeExpiredAnonymousAppraisals: vi.fn(async () => 2),
}));
vi.mock('@/lib/garage/maintenance', () => ({
  dueMaintenanceAlerts: vi.fn(async () => []),
  renewalAlerts: vi.fn(async () => []),
}));
vi.mock('@/lib/market/service', () => ({ takeMarketSnapshot: vi.fn(async () => ({})) }));
vi.mock('@/lib/watches/service', () => ({
  checkPriceWatches: vi.fn(async () => []),
  checkMarketWatches: vi.fn(async () => []),
}));

import { createUser } from '../helpers/db';
import { fixtureProviders, useFixtureProviders } from '../helpers/providers';
import type { Db } from '@/lib/db';
import { alertDeliveries, alerts, vehicles } from '@/lib/db/schema';
import { refreshVehicleValue, purgeExpiredAnonymousAppraisals } from '@/lib/appraisals/service';
import { dueMaintenanceAlerts, renewalAlerts } from '@/lib/garage/maintenance';
import { takeMarketSnapshot } from '@/lib/market/service';
import { checkPriceWatches, checkMarketWatches } from '@/lib/watches/service';
import { runDaily } from '@/lib/jobs/daily';
import { runWeekly } from '@/lib/jobs/weekly';
import { setTestUser } from '@/lib/session';
import { setSenders } from '@/lib/notify';
import * as dailyRoute from '@/app/api/cron/daily/route';
import * as weeklyRoute from '@/app/api/cron/weekly/route';
import { addVehicle, recordingSenders, setSettings, freshDb } from './helpers';

let db: Db;
let userId: string;
const NOW = new Date('2026-11-12T15:00:00Z');

/** The mock really updates lastPrivateValue, like the valuation module does. */
function refreshTo(values: Record<string, number | Error>) {
  vi.mocked(refreshVehicleValue).mockImplementation(async (d, _p, id) => {
    const v = values[id];
    if (v instanceof Error) throw v;
    if (v === undefined) throw new Error('unexpected vehicle');
    await d.update(vehicles).set({ lastPrivateValue: v, lastAppraisedAt: NOW }).where(eq(vehicles.id, id));
    return { private: { value: v, low: v - 1000, high: v + 1000 } } as never;
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(purgeExpiredAnonymousAppraisals).mockResolvedValue(2);
  vi.mocked(dueMaintenanceAlerts).mockResolvedValue([]);
  vi.mocked(renewalAlerts).mockResolvedValue([]);
  vi.mocked(takeMarketSnapshot).mockResolvedValue({} as never);
  vi.mocked(checkPriceWatches).mockResolvedValue([]);
  vi.mocked(checkMarketWatches).mockResolvedValue([]);
  db = await freshDb();
  userId = (await createUser(db)).id;
}, 120000);
afterEach(() => {
  setSenders(null);
  vi.unstubAllEnvs();
});

describe('runDaily', () => {
  it('orchestrates steps, creates value alerts, survives per-vehicle failures', async () => {
    const up = await addVehicle(db, userId, { lastPrivateValue: 26850 });
    const flat = await addVehicle(db, userId, { vin: '4T1B11HK5JU000000', lastPrivateValue: 20000, modelKey: 'toyota|camry|se', zip: '60601', nickname: 'Daily' });
    const broken = await addVehicle(db, userId, { vin: '2T3P1RFV5MW000000', lastPrivateValue: 30000, modelKey: 'toyota|rav4|', zip: '73301' });
    refreshTo({ [up.id]: 27450, [flat.id]: 20100, [broken.id]: new Error('MarketCheck down') });
    vi.mocked(dueMaintenanceAlerts).mockResolvedValue([
      { userId, type: 'maintenance', vehicleId: flat.id, title: 'Oil change is due', body: 'Daily, due Nov 20.', dedupeKey: 'maint:e1:due7' },
    ]);
    vi.mocked(checkPriceWatches).mockRejectedValue(new Error('boom'));
    await setSettings(db, userId, { emailDigest: 'instant' });
    const s = recordingSenders();

    const r = await runDaily(db, fixtureProviders(), NOW, s);
    expect(r.job).toBe('daily');
    expect(r.counts).toMatchObject({
      vehicles: 3, valuesRefreshed: 2, valueFailures: 1, priceWatchFailures: 1, snapshots: 3,
      alertsCreated: 2, appraisalsPurged: 2, delivery_sent: 2,
    });
    expect(JSON.stringify(r)).not.toMatch(/60601|73301|1FA6P8/);

    const rows = await db.select().from(alerts);
    const value = rows.find((a) => a.type === 'value')!;
    expect(value).toMatchObject({ title: 'Mustang GT is up $600', body: 'Private value is now $27,450.', vehicleId: up.id, dedupeKey: `value:${up.id}:2026-11-12` });
    expect(s.rec.email.map((e) => e.subject).sort()).toEqual(['Mustang GT is up $600', 'Oil change is due']);

    // Order and arguments of peer calls.
    expect(vi.mocked(takeMarketSnapshot)).toHaveBeenCalledWith(db, expect.anything(), { modelKey: 'ford|mustang|gt', zip: '60601', radiusMiles: 100, date: '2026-11-12' });
    expect(vi.mocked(checkMarketWatches)).toHaveBeenCalledWith(db, '2026-11-12');
    expect(vi.mocked(renewalAlerts)).toHaveBeenCalledWith(db, '2026-11-12');
    expect(vi.mocked(purgeExpiredAnonymousAppraisals)).toHaveBeenCalledWith(db, NOW);
    const order = (fn: unknown) => vi.mocked(fn as () => void).mock.invocationCallOrder[0]!;
    expect(order(refreshVehicleValue)).toBeLessThan(order(checkPriceWatches));
    expect(order(takeMarketSnapshot)).toBeLessThan(order(checkMarketWatches));

    // Same day again: value alert deduped.
    refreshTo({ [up.id]: 28450, [flat.id]: 20100, [broken.id]: 30000 });
    const again = await runDaily(db, fixtureProviders(), NOW, s);
    expect(again.counts.alertsCreated).toBe(0);
  });

  it('reports a value drop', async () => {
    const v = await addVehicle(db, userId, { lastPrivateValue: 27450 });
    refreshTo({ [v.id]: 26900 });
    await runDaily(db, fixtureProviders(), NOW, recordingSenders());
    const [a] = await db.select().from(alerts);
    expect(a!.title).toBe('Mustang GT is down $550');
  });
});

describe('job time budget', () => {
  it('with no budget left, skips provider work but still creates and delivers DB-only alerts', async () => {
    const v = await addVehicle(db, userId);
    refreshTo({ [v.id]: 99999 });
    vi.mocked(dueMaintenanceAlerts).mockResolvedValue([
      { userId, type: 'maintenance', vehicleId: v.id, title: 'Oil change is due', body: 'b', dedupeKey: 'maint:e9:due7' },
    ]);
    await setSettings(db, userId, { emailDigest: 'instant' });
    const s = recordingSenders();
    const r = await runDaily(db, fixtureProviders(), NOW, s, { budgetMs: 0 });
    expect(vi.mocked(refreshVehicleValue)).not.toHaveBeenCalled();
    expect(vi.mocked(takeMarketSnapshot)).not.toHaveBeenCalled();
    expect(r.counts).toMatchObject({ deferredVehicles: 1, alertsCreated: 1, delivery_sent: 1 });
    const w = await runWeekly(db, fixtureProviders(), NOW, s, { budgetMs: 0 });
    expect(w.counts).toMatchObject({ deferredVehicles: 1 });
    expect(w.counts.recallChecks).toBeUndefined();
  });

  it('weekly memoizes NHTSA calls per make/model/year', async () => {
    await addVehicle(db, userId);
    const u2 = (await createUser(db)).id;
    await addVehicle(db, u2);
    const p = fixtureProviders();
    const spy = vi.spyOn(p.recalls, 'byModelYear');
    const r = await runWeekly(db, p, NOW, recordingSenders());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.counts).toMatchObject({ recallChecks: 2, alertsCreated: 12 });
  });
});

describe('runWeekly', () => {
  it('checks recalls, sends instant recall email, and builds digests', async () => {
    const v = await addVehicle(db, userId);
    await db.insert(alerts).values({ userId, type: 'maintenance', title: 'Old', body: 'b', dedupeKey: 'old' });
    const [old] = await db.select().from(alerts);
    await db.insert(alertDeliveries).values({ alertId: old!.id, channel: 'email', status: 'digest' });
    const s = recordingSenders();
    const r = await runWeekly(db, fixtureProviders(), NOW, s);
    expect(r.counts).toMatchObject({ vehicles: 1, recallChecks: 1, newCampaigns: 6, alertsCreated: 6, digest_sent: 1, delivery_sent: 6 });
    expect(s.rec.email.filter((e) => e.subject === 'New recall notice to review')).toHaveLength(6);
    expect((await db.select().from(alerts).where(eq(alerts.vehicleId, v.id))).every((a) => a.type === 'recall')).toBe(true);
    const again = await runWeekly(db, fixtureProviders(), NOW, s);
    expect(again.counts.newCampaigns).toBe(0);
  });
});

describe('cron routes', () => {
  const call = (route: typeof dailyRoute.GET, auth?: string) =>
    route(new Request('http://localhost:3000/api/cron/x', auth ? { headers: { authorization: auth } } : {}));

  it('503 when CRON_SECRET unset, 401 on bad or missing header', async () => {
    setTestUser(null);
    vi.stubEnv('CRON_SECRET', '');
    expect((await call(dailyRoute.GET, 'Bearer x')).status).toBe(503);
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await call(dailyRoute.GET)).status).toBe(401);
    expect((await call(dailyRoute.GET, 'Bearer nope')).status).toBe(401);
    expect((await call(weeklyRoute.GET, 's3cret')).status).toBe(401);
  });

  it('runs with the right secret', async () => {
    setTestUser(null);
    vi.stubEnv('CRON_SECRET', 's3cret');
    setSenders(recordingSenders());
    useFixtureProviders();
    const res = await call(weeklyRoute.GET, 'Bearer s3cret');
    expect(res.status).toBe(200);
    expect((await res.json()).job).toBe('weekly');
    expect(dailyRoute.maxDuration).toBe(60);
  });
});
