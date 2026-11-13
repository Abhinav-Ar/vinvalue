import { describe, it, expect, beforeEach } from 'vitest';
import type { Db } from '@/lib/db';
import { odometerReadings, serviceIntervals, vehicles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createTestDb, createUser } from '../helpers/db';
import { addMonths, statusText } from '@/lib/garage/dates';
import {
  dueMaintenanceAlerts, effectiveIntervals, estimateMilesPerMonth, milesPerMonth, recordOdometer, renewalAlerts, upcomingMaintenance,
  type UpcomingDateItem, type UpcomingMileageItem,
} from '@/lib/garage/maintenance';
import { badgesFor } from '@/lib/garage/labels';
import { seedDoc, seedEvent, seedVehicle, TODAY } from './helpers';

let db: Db;
let userId: string;
beforeEach(async () => {
  db = await createTestDb();
  userId = (await createUser(db)).id;
}, 60_000);

describe('dates', () => {
  it('formats status like the design', () => {
    expect(statusText('2026-11-18', TODAY)).toBe('in 6 days');
    expect(statusText('2026-11-13', TODAY)).toBe('in 1 day');
    expect(statusText(TODAY, TODAY)).toBe('today');
    expect(statusText('2026-11-09', TODAY)).toBe('3 days overdue');
    expect(statusText('2026-11-11', TODAY)).toBe('1 day overdue');
  });
  it('clamps month addition', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-12', 14)).toBe('2028-01-12');
  });
});

describe('badges', () => {
  it('gives Mustang M, MX-5 X, Supra S', async () => {
    const m = await seedVehicle(db, userId, 'mustang');
    const x = await seedVehicle(db, userId, 'mx5');
    const s = await seedVehicle(db, userId, 'supra');
    const b = badgesFor([s, x, m]);
    expect([b.get(m.id)!.letter, b.get(x.id)!.letter, b.get(s.id)!.letter]).toEqual(['M', 'X', 'S']);
    expect(b.get(m.id)!.label).toBe('Mustang GT');
  });
});

describe('odometer', () => {
  it('rejects backwards readings and updates the vehicle only for the newest reading', async () => {
    const v = await seedVehicle(db, userId, 'mustang'); // 38,200 on 2026-11-01
    await expect(recordOdometer(db, v.id, 38_000, '2026-11-05', 'manual')).rejects.toMatchObject({ status: 400 });
    await expect(recordOdometer(db, v.id, 39_000, '2026-10-01', 'manual')).rejects.toMatchObject({ status: 400 });
    await recordOdometer(db, v.id, 37_000, '2026-09-01', 'service');
    expect((await db.select().from(vehicles).where(eq(vehicles.id, v.id)))[0]!.odometer).toBe(38_200);
    await recordOdometer(db, v.id, 38_900, '2026-11-10', 'manual');
    expect((await db.select().from(vehicles).where(eq(vehicles.id, v.id)))[0]!.odometer).toBe(38_900);
  });

  it('estimates miles per month only with 30+ days of readings', async () => {
    expect(estimateMilesPerMonth([{ miles: 1000, on: '2026-01-01' }, { miles: 1500, on: '2026-01-20' }])).toBeNull();
    // 1,000 miles over 30.4375 days -> 1,000/month (two points: slope == first/last)
    expect(estimateMilesPerMonth([{ miles: 1000, on: '2026-01-01' }, { miles: 2000, on: '2026-01-31' }])).toBe(Math.round((1000 / 30) * 30.4375));
    // Least squares over three collinear points
    expect(estimateMilesPerMonth([{ miles: 0, on: '2026-01-01' }, { miles: 600, on: '2026-01-31' }, { miles: 1200, on: '2026-03-02' }])).toBe(609);

    const v = await seedVehicle(db, userId, 'mustang'); // 38,200 on 11-01 only
    expect(await milesPerMonth(db, v.id)).toBeNull();
    await db.insert(odometerReadings).values({ vehicleId: v.id, miles: 36_200, recordedOn: '2026-07-04', source: 'appraisal' });
    // 2,000 mi over 120 days
    expect(await milesPerMonth(db, v.id)).toBe(Math.round((2000 / 120) * 30.4375));
  });
});

describe('intervals', () => {
  it('vehicle rows override model rows override defaults', async () => {
    const v = await seedVehicle(db, userId, 'mustang');
    await db.insert(serviceIntervals).values([
      { modelKey: v.modelKey, type: 'oil_filter', title: 'Oil + filter', everyMiles: 7500, everyMonths: 12, source: 'manufacturer' },
      { vehicleId: v.id, type: 'oil_filter', title: 'Oil + filter', everyMiles: 4000, everyMonths: null, source: 'user' },
      { modelKey: v.modelKey, type: 'spark_plugs', title: 'Spark plugs', everyMiles: 60000, everyMonths: null, source: 'manufacturer' },
    ]);
    const list = await effectiveIntervals(db, v);
    expect(list.find((i) => i.type === 'oil_filter')).toMatchObject({ everyMiles: 4000, everyMonths: null, scope: 'vehicle' });
    expect(list.find((i) => i.type === 'spark_plugs')).toMatchObject({ scope: 'model' });
    expect(list.find((i) => i.type === 'brake_fluid')).toMatchObject({ source: 'default', everyMonths: 24 });
  });
});

describe('upcomingMaintenance', () => {
  it('reports overdue / today / in N days for scheduled events, most urgent first', async () => {
    const v = await seedVehicle(db, userId, 'mx5', { odometer: 51_900 });
    await seedEvent(db, v.id, { type: 'brake_fluid', title: 'Brake fluid flush', date: '2026-11-09' });
    await seedEvent(db, v.id, { type: 'wipers', title: 'Wiper blades', date: TODAY });
    await seedEvent(db, v.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    const items = (await upcomingMaintenance(db, userId, TODAY)).filter((i): i is UpcomingDateItem => i.kind === 'date' && i.source === 'event');
    expect(items.map((i) => [i.title, i.statusText, i.overdue])).toEqual([
      ['Brake fluid flush', '3 days overdue', true],
      ['Wiper blades', 'today', false],
      ['Oil + filter', 'in 6 days', false],
    ]);
    expect(items[0]!.vehicle?.letter).toBe('M');
  });

  it('builds mileage items: rolled forward with no history, anchored on the last service otherwise', async () => {
    const m = await seedVehicle(db, userId, 'mustang', { odometer: 38_200 });
    const s = await seedVehicle(db, userId, 'supra', { odometer: 22_400 });
    await seedEvent(db, s.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-05-01', status: 'done', odometer: 17_000 });
    await db.insert(odometerReadings).values({ vehicleId: m.id, miles: 36_200, recordedOn: '2026-07-04', source: 'manual' });

    const items = await upcomingMaintenance(db, userId, TODAY);
    const miles = (vid: string, type: string) => items.find((i): i is UpcomingMileageItem => i.kind === 'mileage' && i.vehicleId === vid && i.type === type)!;

    const oil = miles(m.id, 'oil_filter');
    expect(oil).toMatchObject({ currentMiles: 38_200, dueAtMiles: 40_000, milesLeft: 1_800, overdue: false, statusText: '1,800 mi left' });
    // 2,000 mi over 120 days -> ~507 mi/month -> 1,800 mi in ~108 days
    expect(oil.milesPerMonth).toBe(507);
    expect(oil.projectedDate).toBe('2027-02-28');
    expect(miles(s.id, 'brake_pads')).toMatchObject({ dueAtMiles: 30_000, milesLeft: 7_600 });

    const supraOil = miles(s.id, 'oil_filter');
    expect(supraOil).toMatchObject({ dueAtMiles: 22_000, milesLeft: -400, overdue: true, statusText: '400 mi overdue', projectedDate: null });
    // Oil by months: done 2026-05-01 + 6 months = 2026-11-01, 11 days overdue
    const supraOilDate = items.find((i) => i.kind === 'date' && i.vehicleId === s.id && i.type === 'oil_filter') as UpcomingDateItem;
    expect(supraOilDate).toMatchObject({ source: 'interval', date: '2026-11-01', statusText: '11 days overdue' });
    // Overdue things sort first
    expect(items[0]!.overdue).toBe(true);
  });

  it('suppresses an interval date item when that service is already scheduled; skips month items with no anchor', async () => {
    const v = await seedVehicle(db, userId, 'mustang', { purchaseDate: '2025-03-02', purchaseOdometer: 21_000 });
    await seedEvent(db, v.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    const items = await upcomingMaintenance(db, userId, TODAY, { vehicleId: v.id });
    const oilDates = items.filter((i) => i.kind === 'date' && i.type === 'oil_filter');
    expect(oilDates).toHaveLength(1);
    expect(oilDates[0]!.source).toBe('event');
    // Battery every 12 months from purchase 2025-03-02 rolls forward to 2027-03-02
    expect(items.find((i) => i.kind === 'date' && i.type === 'battery')).toMatchObject({ date: '2027-03-02' });
    // Mileage from purchase odometer: 21,000 + 5,000k -> next above 38,200 is 41,000
    expect(items.find((i) => i.kind === 'mileage' && i.type === 'oil_filter')).toMatchObject({ dueAtMiles: 41_000 });

    const noAnchor = await seedVehicle(db, userId, 'mx5');
    const items2 = await upcomingMaintenance(db, userId, TODAY, { vehicleId: noAnchor.id });
    expect(items2.filter((i) => i.kind === 'date')).toHaveLength(0);
  });
});

describe('alert drafts', () => {
  it('drafts maintenance alerts with stable dedupe keys', async () => {
    const x = await seedVehicle(db, userId, 'mx5', { odometer: 54_700 }); // tires? default rotation 6k: next 60,000 (5,300 left)
    const late = await seedEvent(db, x.id, { type: 'brake_fluid', title: 'Brake fluid flush', date: '2026-11-09' });
    const soon = await seedEvent(db, x.id, { type: 'oil_filter', title: 'Oil + filter', date: '2026-11-18' });
    await seedEvent(db, x.id, { type: 'coolant', title: 'Coolant check', date: '2026-12-15' }); // too far
    const s = await seedVehicle(db, userId, 'supra', { odometer: 29_700 }); // brake pads due 30,000 -> 300 mi

    const drafts = await dueMaintenanceAlerts(db, TODAY);
    const byKey = new Map(drafts.map((d) => [d.dedupeKey, d]));
    expect(byKey.get(`maint:${late.id}:overdue`)).toMatchObject({ userId, type: 'maintenance', vehicleId: x.id, title: 'Brake fluid flush is 3 days overdue' });
    expect(byKey.get(`maint:${soon.id}:due7`)).toMatchObject({ title: 'Oil + filter is due in 6 days' });
    expect(byKey.get(`maint:${s.id}:brake_pads:30000:mi500`)).toMatchObject({ title: 'Brake pads is due in 300 mi' });
    // Oil is scheduled for the MX-5, so no mileage alert for it there
    expect(drafts.some((d) => d.dedupeKey.startsWith(`maint:${x.id}:oil_filter:`))).toBe(false);
    expect(drafts.some((d) => d.title.startsWith('Coolant'))).toBe(false);
    // Stable across runs
    expect((await dueMaintenanceAlerts(db, TODAY)).map((d) => d.dedupeKey).sort()).toEqual(drafts.map((d) => d.dedupeKey).sort());
    expect(drafts.every((d) => !d.title.includes('—') && !d.body.includes('—'))).toBe(true);
  });

  it('drafts renewal alerts within 30 days', async () => {
    const x = await seedVehicle(db, userId, 'mx5');
    const ins = await seedDoc(db, x.id, { kind: 'insurance', expiresOn: '2026-11-24' });
    await seedDoc(db, x.id, { kind: 'registration', expiresOn: '2026-12-22' }); // 40 days out
    await seedDoc(db, x.id, { kind: 'title' }); // no expiry
    await seedDoc(db, x.id, { kind: 'insurance', expiresOn: '2026-11-01' }); // already past
    const drafts = await renewalAlerts(db, TODAY);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ userId, type: 'renewal', vehicleId: x.id, title: 'Insurance renews Nov 24', dedupeKey: `renew:${ins.id}:2026-11-24:30d` });
    expect(await renewalAlerts(db, '2026-11-22')).toHaveLength(2);
  });
});
