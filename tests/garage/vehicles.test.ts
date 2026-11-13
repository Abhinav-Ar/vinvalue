import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { appraisals, odometerReadings, recallChecks, vehicles } from '@/lib/db/schema';
import { setTestUser } from '@/lib/session';
import { createTestDb, createUser } from '../helpers/db';
import { FIXTURE_VINS, useFixtureProviders } from '../helpers/providers';
import * as vehiclesRoute from '@/app/api/vehicles/route';
import * as vehicleRoute from '@/app/api/vehicles/[id]/route';
import * as overviewRoute from '@/app/api/vehicles/[id]/overview/route';
import * as odometerRoute from '@/app/api/vehicles/[id]/odometer/route';
import { call, freezeToday, seedAppraisal, seedDoc, seedEvent, seedVehicle } from './helpers';

let db: Db;
let userId: string;
let otherId: string;
beforeEach(async () => {
  freezeToday();
  db = await createTestDb();
  useFixtureProviders();
  userId = (await createUser(db)).id;
  otherId = (await createUser(db)).id;
  setTestUser(userId);
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
});

const createBody = { vin: FIXTURE_VINS.mustang2019, trim: 'gt', zip: '60601', odometer: '38,200', purchasePrice: 31500, purchaseDate: '2025-03-02', purchaseOdometer: 21000 };

describe('POST /api/vehicles', () => {
  it('creates from a VIN, validates trim, records readings, and 409s a duplicate', async () => {
    const r = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: createBody });
    expect(r.status).toBe(201);
    expect(r.json.label.toLowerCase()).toBe('2019 ford mustang gt');
    expect(r.json).toMatchObject({ trim: 'GT', modelKey: 'ford|mustang|gt', odometer: 38200, zip: '60601', trimConfirmed: true, flags: [] });
    expect(r.json.specs.trimRaw).toBe('GT Coupe');
    const readings = await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, r.json.id));
    expect(readings.map((x) => [x.miles, x.recordedOn, x.source]).sort()).toEqual([[21000, '2025-03-02', 'purchase'], [38200, '2026-11-12', 'manual']]);

    const dup = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: createBody });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe('conflict');
  });

  it('rejects an unknown trim, a missing ZIP, and a bad check digit unless imported', async () => {
    const bad = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { ...createBody, trim: 'Shelby' } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.fields.trim).toBeTruthy();
    const noZip = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { vin: FIXTURE_VINS.mustang2019, odometer: 1000 } });
    expect(noZip.status).toBe(400);
    expect(noZip.json.error.fields.zip).toBeTruthy();
    const cd = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { vin: FIXTURE_VINS.badCheckDigit, zip: '60601', odometer: 1000 } });
    expect(cd.status).toBe(400);
    expect(cd.json.error.fields.vin).toBeTruthy();
    const imp = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { vin: FIXTURE_VINS.badCheckDigit, zip: '60601', odometer: 1000, importedVehicle: true } });
    expect(imp.status).toBe(201);
    expect(imp.json.trim).toBeNull();
    expect(imp.json.trimConfirmed).toBe(false);
  });

  it('flags mileage far above use for the car age', async () => {
    const r = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { vin: FIXTURE_VINS.mustang2019, zip: '60601', odometer: 400_000 } });
    expect(r.json.flags).toContain('mileage_high_for_age');
  });

  it('creates from an owned appraisal and links it; 404 for someone else\'s', async () => {
    const a = await seedAppraisal(db, { userId, value: 27450, createdAt: new Date('2026-11-10T15:00:00Z'), mileage: 38_100 });
    const theirs = await seedAppraisal(db, { userId: otherId, value: 1, createdAt: new Date('2026-11-10T15:00:00Z'), vin: FIXTURE_VINS.mx5rf2017 });
    const nope = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { fromAppraisalId: theirs.id } });
    expect(nope.status).toBe(404);

    const r = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { fromAppraisalId: a.id, nickname: 'Blue' } });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ vin: FIXTURE_VINS.mustang2019, trim: 'GT', odometer: 38_100, privateValue: 27450, nickname: 'Blue' });
    const [linked] = await db.select().from(appraisals).where(eq(appraisals.id, a.id));
    expect(linked!.vehicleId).toBe(r.json.id);
    const [reading] = await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, r.json.id));
    expect(reading).toMatchObject({ miles: 38_100, recordedOn: '2026-11-10', source: 'appraisal' });

    const dup = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { vin: FIXTURE_VINS.mustang2019, zip: '60601', odometer: 38200 } });
    expect(dup.status).toBe(409);
  });
});

describe('POST /api/vehicles from an appraisal with an auto-filled trim', () => {
  it('does not mark an auto-filled trim as confirmed', async () => {
    const a = await seedAppraisal(db, { userId, value: 41200, createdAt: new Date('2026-11-10T15:00:00Z'), vin: FIXTURE_VINS.supra2020, trim: '3.0', trimConfirmedByUser: false });
    const r = await call(vehiclesRoute.POST, '/api/vehicles', { method: 'POST', body: { fromAppraisalId: a.id } });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ trim: null, trimConfirmed: false });
  });
});

describe('GET /api/vehicles (Garage)', () => {
  it('returns values, change since last appraisal, next service and totals', async () => {
    const m = await seedVehicle(db, userId, 'mustang', { lastPrivateValue: 27450 });
    await seedAppraisal(db, { userId, vehicleId: m.id, value: 26850, createdAt: new Date('2026-09-14T15:00:00Z'), reportSeq: 2 });
    await seedAppraisal(db, { userId, vehicleId: m.id, value: 27450, createdAt: new Date('2026-11-12T15:00:00Z'), reportSeq: 3 });
    await seedEvent(db, m.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    const x = await seedVehicle(db, userId, 'mx5', { odometer: 51_900, zip: '60614', lastPrivateValue: 19800 });
    await seedEvent(db, x.id, { type: 'brake_fluid', title: 'Brake fluid flush', date: '2026-11-09' });
    await seedEvent(db, x.id, { type: 'coolant', title: 'Coolant check', date: '2027-01-15' });
    await seedVehicle(db, otherId, 'supra', { lastPrivateValue: 41200 });

    const r = await call(vehiclesRoute.GET, '/api/vehicles');
    expect(r.status).toBe(200);
    expect(r.json.totals).toEqual({ vehicles: 2, totalPrivateValue: 47250, dueIn30Days: 2 });
    const [gm, gx] = r.json.vehicles;
    expect(gm).toMatchObject({ label: '2019 Ford Mustang GT', odometer: 38200, zip: '60601', privateValue: 27450, change: { amount: 600, sinceDate: '2026-09-14' } });
    expect(gm.nextService).toMatchObject({ title: 'Oil + filter', date: '2026-11-18', statusText: 'in 6 days' });
    expect(gx.nextService).toMatchObject({ title: 'Brake fluid flush', statusText: '3 days overdue', overdue: true });
    expect(gx.change).toBeNull();
  });

  it('requires sign in', async () => {
    setTestUser(null);
    expect((await call(vehiclesRoute.GET, '/api/vehicles')).status).toBe(401);
  });
});

describe('vehicle detail, patch, delete, odometer', () => {
  it('PATCH recomputes modelKey, records odometer, rejects backwards; DELETE removes', async () => {
    const v = await seedVehicle(db, userId, 'mustang', { trim: null });
    const p = await call(vehicleRoute.PATCH, `/api/vehicles/${v.id}`, { method: 'PATCH', params: { id: v.id }, body: { trim: 'GT', odometer: 38_500, nickname: 'Pony' } });
    expect(p.status).toBe(200);
    expect(p.json).toMatchObject({ trim: 'GT', modelKey: 'ford|mustang|gt', odometer: 38_500, nickname: 'Pony' });
    const back = await call(vehicleRoute.PATCH, `/api/vehicles/${v.id}`, { method: 'PATCH', params: { id: v.id }, body: { odometer: 30_000 } });
    expect(back.status).toBe(400);
    const badTrim = await call(vehicleRoute.PATCH, `/api/vehicles/${v.id}`, { method: 'PATCH', params: { id: v.id }, body: { trim: 'EcoBoost' } });
    expect(badTrim.status).toBe(400);
    const unknown = await call(vehicleRoute.PATCH, `/api/vehicles/${v.id}`, { method: 'PATCH', params: { id: v.id }, body: { userId: otherId } });
    expect(unknown.status).toBe(400);

    const o1 = await call(odometerRoute.POST, `/api/vehicles/${v.id}/odometer`, { method: 'POST', params: { id: v.id }, body: { miles: 38_400, on: '2026-11-12' } });
    expect(o1.status).toBe(400);
    const o2 = await call(odometerRoute.POST, `/api/vehicles/${v.id}/odometer`, { method: 'POST', params: { id: v.id }, body: { miles: 38_700, on: '2026-11-12' } });
    expect(o2.status).toBe(201);
    expect(o2.json.odometer).toBe(38_700);
    const fut = await call(odometerRoute.POST, `/api/vehicles/${v.id}/odometer`, { method: 'POST', params: { id: v.id }, body: { miles: 40_000, on: '2026-12-01' } });
    expect(fut.status).toBe(400);
    const list = await call(odometerRoute.GET, `/api/vehicles/${v.id}/odometer`, { params: { id: v.id } });
    expect(list.json.readings.map((r: { miles: number }) => r.miles)).toEqual([38_200, 38_500, 38_700]);

    const d = await call(vehicleRoute.DELETE, `/api/vehicles/${v.id}`, { method: 'DELETE', params: { id: v.id } });
    expect(d.status).toBe(204);
    expect(await db.select().from(vehicles).where(eq(vehicles.id, v.id))).toHaveLength(0);
  });

  it('returns 404 for another user\'s vehicle on every vehicle route', async () => {
    const theirs = await seedVehicle(db, otherId, 'supra');
    const params = { id: theirs.id };
    const path = `/api/vehicles/${theirs.id}`;
    const results = await Promise.all([
      call(vehicleRoute.GET, path, { params }),
      call(vehicleRoute.PATCH, path, { method: 'PATCH', params, body: { nickname: 'mine' } }),
      call(vehicleRoute.DELETE, path, { method: 'DELETE', params }),
      call(overviewRoute.GET, `${path}/overview`, { params }),
      call(odometerRoute.GET, `${path}/odometer`, { params }),
      call(odometerRoute.POST, `${path}/odometer`, { method: 'POST', params, body: { miles: 50_000, on: '2026-11-12' } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
    expect(await db.select().from(vehicles).where(eq(vehicles.id, theirs.id))).toHaveLength(1);
  });
});

describe('GET /api/vehicles/[id]/overview', () => {
  it('matches the Vehicle page numbers', async () => {
    const v = await seedVehicle(db, userId, 'mustang', { lastPrivateValue: 27450, purchasePrice: 31500, purchaseDate: '2025-03-02', purchaseOdometer: 21000 });
    await seedAppraisal(db, { userId, vehicleId: v.id, value: 26850, createdAt: new Date('2026-09-14T15:00:00Z'), reportSeq: 2 });
    await seedAppraisal(db, { userId, vehicleId: v.id, value: 27450, createdAt: new Date('2026-11-12T15:00:00Z'), reportSeq: 3 });
    await seedEvent(db, v.id, { type: 'brake_pads', title: 'Front brake pads', date: '2026-10-03', status: 'done', costCents: 38600, shop: 'Independent shop', odometer: 37_400 });
    await seedEvent(db, v.id, { type: 'tire_rotation', title: 'Tire rotation', date: '2026-09-14', status: 'done', costCents: 4000, shop: 'Independent shop', odometer: 36_900 });
    await seedEvent(db, v.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    await db.insert(recallChecks).values({ vehicleId: v.id, basis: 'model_year', checkedAt: new Date('2026-11-10T08:00:00Z'), results: [] });
    await seedDoc(db, v.id, { kind: 'title', label: 'Clean', fileKey: 'k1', createdAt: new Date('2025-03-05T12:00:00Z') });
    await seedDoc(db, v.id, { kind: 'registration', expiresOn: '2026-12-22' });
    await seedDoc(db, v.id, { kind: 'insurance', expiresOn: '2027-05-01' });
    for (let i = 0; i < 6; i++) await seedDoc(db, v.id, { kind: 'receipt', fileKey: `r${i}` });

    const r = await call(overviewRoute.GET, `/api/vehicles/${v.id}/overview`, { params: { id: v.id } });
    expect(r.status).toBe(200);
    const o = r.json;
    expect(o.specs).toMatchObject({ engine: '5.0L V8', drive: 'RWD', body: 'Coupe', plant: 'Flat Rock, MI', trim: { value: 'GT', confirmed: true, text: 'GT (you confirmed)' } });
    expect(o.privateValue).toBe(27450);
    expect(o.changeSinceLast).toEqual({ amount: 600, sinceDate: '2026-09-14' });
    expect(o.sincePurchase).toEqual({ amount: -4050, purchasePrice: 31500 });
    expect(o.nextService).toMatchObject({ title: 'Oil + filter', date: '2026-11-18', statusText: 'in 6 days' });
    expect(o.openRecalls).toEqual({ count: 0, checkedAt: '2026-11-10T08:00:00.000Z', basis: 'model_year' });
    expect(o.timeline.map((t: { date: string; title: string; detail: string }) => [t.date, t.title, t.detail])).toEqual([
      ['2026-11-12', 'Appraisal, Rev D', '$27,450 private sale'],
      ['2026-10-03', 'Front brake pads', '$386, Independent shop'],
      ['2026-09-14', 'Appraisal, Rev C', '$26,850 private sale'],
      ['2026-09-14', 'Tire rotation', '$40, Independent shop'],
      ['2025-03-02', 'Purchased', '$31,500, 21,000 mi'],
    ]);
    expect(o.documents).toMatchObject({
      title: { status: 'on_file', text: 'Clean, scanned Mar 2025' },
      registration: { status: 'on_file', text: 'Renews Dec 22, 2026' },
      insurance: { status: 'on_file', text: 'Expires May 2027' },
      receipts: { count: 6, text: '6 files' },
    });
    expect(o.reported).toEqual([
      { key: 'condition', value: 'good', note: 'you reported' },
      { key: 'accidents', value: 'none', note: 'you reported' },
      { key: 'owners', value: 1, note: 'you reported' },
    ]);
  });

  it('returns nulls without appraisals, purchase data or recall checks', async () => {
    const v = await seedVehicle(db, userId, 'mx5', { trim: null });
    const r = await call(overviewRoute.GET, `/api/vehicles/${v.id}/overview`, { params: { id: v.id } });
    expect(r.json).toMatchObject({ privateValue: null, changeSinceLast: null, sincePurchase: null, openRecalls: null, timeline: [], reported: [] });
    expect(r.json.specs.trim).toEqual({ value: null, decoded: 'Grand Touring', confirmed: false, text: 'Grand Touring' });
    expect(r.json.documents.registration).toMatchObject({ status: 'missing' });
  });
});
