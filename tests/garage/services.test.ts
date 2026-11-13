import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { odometerReadings, serviceEvents, vehicles } from '@/lib/db/schema';
import { setTestUser } from '@/lib/session';
import { createTestDb, createUser } from '../helpers/db';
import * as eventsRoute from '@/app/api/service-events/route';
import * as eventRoute from '@/app/api/service-events/[id]/route';
import * as logRoute from '@/app/api/maintenance/log/route';
import * as spendRoute from '@/app/api/maintenance/spend/route';
import * as upcomingRoute from '@/app/api/maintenance/upcoming/route';
import * as intervalsRoute from '@/app/api/maintenance/intervals/route';
import { csvField, logToCsv } from '@/lib/garage/services';
import { call, freezeToday, seedDoc, seedEvent, seedVehicle } from './helpers';

let db: Db;
let userId: string;
let otherId: string;
beforeEach(async () => {
  freezeToday();
  db = await createTestDb();
  userId = (await createUser(db)).id;
  otherId = (await createUser(db)).id;
  setTestUser(userId);
}, 60_000);
afterEach(() => {
  vi.useRealTimers();
});

/** The design's service log (Garage-Maintenance): $426 / $686 / $338, $1,450 total. */
async function seedDesignLog() {
  const m = await seedVehicle(db, userId, 'mustang');
  const x = await seedVehicle(db, userId, 'mx5', { odometer: 51_900 });
  const s = await seedVehicle(db, userId, 'supra', { odometer: 22_400 });
  const done = { status: 'done' as const };
  await seedEvent(db, s.id, { ...done, type: 'oil_filter', title: 'Oil + filter', date: '2026-10-28', odometer: 21_900, costCents: 11800, shop: 'Dealer' });
  await seedEvent(db, m.id, { ...done, type: 'brake_pads', title: 'Front brake pads', date: '2026-10-03', odometer: 37_400, costCents: 38600, shop: 'Independent shop' });
  await seedEvent(db, m.id, { ...done, type: 'tire_rotation', title: 'Tire rotation', date: '2026-09-14', odometer: 36_900, costCents: 4000, shop: 'Independent shop' });
  await seedEvent(db, x.id, { ...done, type: 'oil_filter', title: 'Oil + filter', date: '2026-08-21', odometer: 50_800, costCents: 7400, shop: 'DIY' });
  await seedEvent(db, s.id, { ...done, type: 'detail', title: 'Detail + wax', date: '2026-07-09', odometer: 20_600, costCents: 22000, shop: 'Detailer' });
  await seedEvent(db, x.id, { ...done, type: 'tires', title: 'New tires (4)', date: '2026-06-02', odometer: 49_300, costCents: 61200, shop: 'Tire shop' });
  // Not counted: last year, scheduled, someone else's
  await seedEvent(db, m.id, { ...done, type: 'oil_filter', title: 'Oil + filter', date: '2025-12-30', costCents: 9900 });
  await seedEvent(db, m.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18', costCents: 5000 });
  const o = await seedVehicle(db, otherId, 'mustang');
  await seedEvent(db, o.id, { ...done, type: 'oil_filter', title: 'Oil + filter', date: '2026-05-01', costCents: 100000 });
  return { m, x, s };
}

describe('spend + log', () => {
  it('totals spend per vehicle like the design', async () => {
    const { m, x, s } = await seedDesignLog();
    const r = await call(spendRoute.GET, '/api/maintenance/spend?year=2026');
    expect(r.status).toBe(200);
    expect(r.json.totalCents).toBe(145000);
    expect(r.json.vehicles.map((v: { vehicleId: string; label: string; totalCents: number }) => [v.vehicleId, v.label, v.totalCents])).toEqual([
      [m.id, 'Mustang GT', 42600], [x.id, 'MX-5 Grand Touring', 68600], [s.id, 'Supra 3.0', 33800],
    ]);
  });

  it('lists done services newest first, filters by vehicle, and exports CSV', async () => {
    const { m } = await seedDesignLog();
    const r = await call(logRoute.GET, '/api/maintenance/log?year=2026');
    expect(r.json.items.map((i: { date: string; vehicle: string; service: string; miles: number; costCents: number; shop: string }) => [i.date, i.vehicle, i.service, i.miles, i.costCents, i.shop])).toEqual([
      ['2026-10-28', 'Supra', 'Oil + filter', 21900, 11800, 'Dealer'],
      ['2026-10-03', 'Mustang', 'Front brake pads', 37400, 38600, 'Independent shop'],
      ['2026-09-14', 'Mustang', 'Tire rotation', 36900, 4000, 'Independent shop'],
      ['2026-08-21', 'MX-5', 'Oil + filter', 50800, 7400, 'DIY'],
      ['2026-07-09', 'Supra', 'Detail + wax', 20600, 22000, 'Detailer'],
      ['2026-06-02', 'MX-5', 'New tires (4)', 49300, 61200, 'Tire shop'],
    ]);
    const one = await call(logRoute.GET, `/api/maintenance/log?year=2026&vehicleId=${m.id}`);
    expect(one.json.items).toHaveLength(2);

    const csv = await call(logRoute.GET, '/api/maintenance/log?year=2026&format=csv');
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('content-disposition')).toBe('attachment; filename="autoiq-service-log-2026.csv"');
    const lines = csv.text.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Vehicle,Service,Miles,Cost,Where,Receipt');
    expect(lines[1]).toBe('2026-10-28,2020 Toyota Supra 3.0,Oil + filter,21900,118.00,Dealer,');
    expect(lines).toHaveLength(7);
  });

  it('escapes CSV fields', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('Joe\'s "Garage", Inc')).toBe('"Joe\'s ""Garage"", Inc"');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('=HYPERLINK("x")', { text: true })).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField('-5', { text: true })).toBe("'-5");
    expect(csvField(null)).toBe('');
    const out = logToCsv([{ id: '1', date: '2026-01-02', vehicleId: 'v', vehicle: 'A', vehicleLabel: 'Car, "Red"', service: '@cmd', type: 'x', miles: 10, costCents: 1234, shop: null, receipt: { documentId: 'd', url: '/api/documents/d/download' } }], 'https://app.test');
    expect(out).toBe('Date,Vehicle,Service,Miles,Cost,Where,Receipt\r\n2026-01-02,"Car, ""Red""",\'@cmd,10,12.34,,https://app.test/api/documents/d/download\r\n');
  });
});

describe('service events + calendar', () => {
  it('returns calendar items in range with renewals, badges and overdue flags', async () => {
    const m = await seedVehicle(db, userId, 'mustang');
    const x = await seedVehicle(db, userId, 'mx5');
    await seedEvent(db, x.id, { type: 'brake_fluid', title: 'Brake fluid flush', date: '2026-11-09' });
    await seedEvent(db, m.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    await seedEvent(db, m.id, { type: 'tire_rotation', title: 'Tire rotation', date: '2026-12-09' }); // out of range
    await seedDoc(db, x.id, { kind: 'insurance', expiresOn: '2026-11-24' });
    await seedDoc(db, m.id, { kind: 'registration', expiresOn: '2026-12-22' }); // out of range
    const theirs = await seedVehicle(db, otherId, 'supra');
    await seedEvent(db, theirs.id, { type: 'oil_filter', title: 'Theirs', date: '2026-11-15' });

    const r = await call(eventsRoute.GET, '/api/service-events?from=2026-11-01&to=2026-11-30');
    expect(r.status).toBe(200);
    expect(r.json.items.map((i: { kind: string; title: string; date: string; overdue: boolean; vehicle: { letter: string } }) => [i.kind, i.title, i.date, i.overdue, i.vehicle.letter])).toEqual([
      ['service', 'Brake fluid flush', '2026-11-09', true, 'X'],
      ['service', 'Oil + filter', '2026-11-18', false, 'M'],
      ['renewal', 'Insurance renews', '2026-11-24', false, 'X'],
    ]);
    const filtered = await call(eventsRoute.GET, `/api/service-events?from=2026-11-01&to=2026-12-31&vehicleId=${m.id}`);
    expect(filtered.json.items.map((i: { title: string }) => i.title)).toEqual(['Oil + filter', 'Tire rotation', 'Registration renews']);
    expect((await call(eventsRoute.GET, `/api/service-events?from=2026-11-01&to=2026-11-30&vehicleId=${theirs.id}`)).status).toBe(404);
    expect((await call(eventsRoute.GET, '/api/service-events?from=2026-11-30&to=2026-11-01')).status).toBe(400);
    expect((await call(eventsRoute.GET, '/api/service-events?from=2026-11-01')).status).toBe(400);
  });

  it('creates, completes (records odometer), reschedules and deletes', async () => {
    const m = await seedVehicle(db, userId, 'mustang'); // 38,200 on 11-01
    const receipt = await seedDoc(db, m.id, { kind: 'receipt', fileKey: 'k' });
    const c = await call(eventsRoute.POST, '/api/service-events', { method: 'POST', body: { vehicleId: m.id, type: 'oil_filter', title: 'Oil + filter', date: '2026-11-14' } });
    expect(c.status).toBe(201);
    expect(c.json).toMatchObject({ status: 'scheduled', overdue: false });

    const resched = await call(eventRoute.PATCH, `/api/service-events/${c.json.id}`, { method: 'PATCH', params: { id: c.json.id }, body: { date: '2026-11-20' } });
    expect(resched.json.date).toBe('2026-11-20');

    const future = await call(eventRoute.PATCH, `/api/service-events/${c.json.id}`, { method: 'PATCH', params: { id: c.json.id }, body: { status: 'done' } });
    expect(future.status).toBe(400); // done in the future

    const done = await call(eventRoute.PATCH, `/api/service-events/${c.json.id}`, {
      method: 'PATCH', params: { id: c.json.id },
      body: { status: 'done', date: '2026-11-12', odometer: 38_450, costCents: 8900, shop: 'Quick Lube', receiptDocumentId: receipt.id },
    });
    expect(done.status).toBe(200);
    expect(done.json).toMatchObject({ status: 'done', odometer: 38_450, costCents: 8900, receiptDocumentId: receipt.id });
    expect(done.json.completedAt).toBeTruthy();
    const readings = await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, m.id));
    expect(readings.find((r) => r.source === 'service')).toMatchObject({ miles: 38_450, recordedOn: '2026-11-12' });
    expect((await db.select().from(vehicles).where(eq(vehicles.id, m.id)))[0]!.odometer).toBe(38_450);

    const backwards = await call(eventsRoute.POST, '/api/service-events', { method: 'POST', body: { vehicleId: m.id, type: 'tire_rotation', title: 'Tire rotation', date: '2026-11-12', status: 'done', odometer: 30_000 } });
    expect(backwards.status).toBe(400);

    const del = await call(eventRoute.DELETE, `/api/service-events/${c.json.id}`, { method: 'DELETE', params: { id: c.json.id } });
    expect(del.status).toBe(204);
    expect(await db.select().from(serviceEvents).where(eq(serviceEvents.id, c.json.id))).toHaveLength(0);
  });

  it('enforces ownership on events, vehicles in bodies and receipts', async () => {
    const mine = await seedVehicle(db, userId, 'mustang');
    const theirs = await seedVehicle(db, otherId, 'supra');
    const theirEvent = await seedEvent(db, theirs.id, { type: 'oil_filter', title: 'Oil', date: '2026-11-20' });
    const theirReceipt = await seedDoc(db, theirs.id, { kind: 'receipt' });
    const myEvent = await seedEvent(db, mine.id, { type: 'oil_filter', title: 'Oil', date: '2026-11-20' });
    const p = { id: theirEvent.id };
    const results = await Promise.all([
      call(eventRoute.GET, `/api/service-events/${theirEvent.id}`, { params: p }),
      call(eventRoute.PATCH, `/api/service-events/${theirEvent.id}`, { method: 'PATCH', params: p, body: { date: '2026-11-21' } }),
      call(eventRoute.DELETE, `/api/service-events/${theirEvent.id}`, { method: 'DELETE', params: p }),
      call(eventsRoute.POST, '/api/service-events', { method: 'POST', body: { vehicleId: theirs.id, type: 'oil_filter', title: 'X', date: '2026-11-20' } }),
      call(eventsRoute.POST, '/api/service-events', { method: 'POST', body: { vehicleId: mine.id, type: 'oil_filter', title: 'X', date: '2026-11-20', receiptDocumentId: theirReceipt.id } }),
      call(eventRoute.PATCH, `/api/service-events/${myEvent.id}`, { method: 'PATCH', params: { id: myEvent.id }, body: { receiptDocumentId: theirReceipt.id } }),
      call(logRoute.GET, `/api/maintenance/log?vehicleId=${theirs.id}`),
      call(upcomingRoute.GET, `/api/maintenance/upcoming?vehicleId=${theirs.id}`),
      call(intervalsRoute.GET, `/api/maintenance/intervals?vehicleId=${theirs.id}`),
      call(intervalsRoute.PUT, `/api/maintenance/intervals?vehicleId=${theirs.id}`, { method: 'PUT', body: { intervals: [] } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404, 404, 404, 404]);
    const spendR = await call(spendRoute.GET, '/api/maintenance/spend?year=2026');
    expect(spendR.json.vehicles).toHaveLength(1);
    setTestUser(null);
    expect((await call(spendRoute.GET, '/api/maintenance/spend')).status).toBe(401);
  });
});

describe('upcoming + intervals routes', () => {
  it('returns upcoming split into date and mileage items', async () => {
    const m = await seedVehicle(db, userId, 'mustang');
    await seedEvent(db, m.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    const r = await call(upcomingRoute.GET, `/api/maintenance/upcoming?vehicleId=${m.id}`);
    expect(r.status).toBe(200);
    expect(r.json.today).toBe('2026-11-12');
    expect(r.json.dueNext[0]).toMatchObject({ title: 'Oil + filter', statusText: 'in 6 days', vehicle: { letter: 'M' } });
    expect(r.json.byMileage.find((i: { type: string }) => i.type === 'oil_filter')).toMatchObject({ dueAtMiles: 40_000, milesLeft: 1_800 });
  });

  it('lists defaults and replaces vehicle overrides', async () => {
    const m = await seedVehicle(db, userId, 'mustang');
    const g = await call(intervalsRoute.GET, `/api/maintenance/intervals?vehicleId=${m.id}`);
    expect(g.json.intervals.find((i: { type: string }) => i.type === 'oil_filter')).toMatchObject({ everyMiles: 5000, everyMonths: 6, source: 'default' });
    const put = await call(intervalsRoute.PUT, `/api/maintenance/intervals?vehicleId=${m.id}`, { method: 'PUT', body: { intervals: [{ type: 'oil_filter', title: 'Oil + filter', everyMiles: 7500 }] } });
    expect(put.status).toBe(200);
    expect(put.json.intervals.find((i: { type: string }) => i.type === 'oil_filter')).toMatchObject({ everyMiles: 7500, everyMonths: null, source: 'user' });
    const bad = await call(intervalsRoute.PUT, `/api/maintenance/intervals?vehicleId=${m.id}`, { method: 'PUT', body: { intervals: [{ type: 'oil_filter', title: 'Oil' }] } });
    expect(bad.status).toBe(400);
  });
});
