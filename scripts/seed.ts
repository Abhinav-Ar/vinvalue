/**
 * Seeds the demo garage from the designs:
 *   2019 Ford Mustang GT (38,200 mi, 60601), 2017 Mazda MX-5 RF (51,900 mi, 60614),
 *   2020 Toyota GR Supra (22,400 mi, 60601), with appraisal history, service events,
 *   documents, a price watch, saved buy checks and alerts.
 *
 * Usage:  DATABASE_URL=... npm run db:seed
 *   SEED_USER_EMAIL=you@gmail.com  attach the garage to an existing user (sign in with Google once first).
 *   Without it, a demo user demo@autoiq.test is (re)created.
 * Idempotent: removes the target user's existing vehicles, appraisals, buy checks, watches and alerts first.
 *
 * Values are demo figures copied from the design mockups, not market data.
 */
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { getDb, type Db } from '../src/lib/db';
import * as s from '../src/lib/db/schema';
import { modelKey } from '../src/lib/model-key';
import { mapRecall } from '../src/lib/providers/nhtsa';
import { valuationConfig as cfg } from '../src/config/valuation';

const DEMO_EMAIL = 'demo@autoiq.test';

const specs = {
  mustang: { year: 2019, make: 'Ford', model: 'Mustang', trimRaw: 'GT Coupe', trimCandidates: ['GT'], body: 'Coupe', drive: 'RWD', engine: '5.0L V8', fuel: 'Gasoline', doors: 2, plant: 'Flat Rock, Michigan, United States (USA)', checkDigitValid: true },
  mx5: { year: 2017, make: 'Mazda', model: 'MX-5', trimRaw: 'Grand Touring', trimCandidates: ['Grand Touring'], body: 'Convertible/Cabriolet', drive: 'RWD', engine: '2.0L I4', fuel: 'Gasoline', doors: 2, plant: 'Hiroshima, Japan', checkDigitValid: true },
  supra: { year: 2020, make: 'Toyota', model: 'Supra', trimRaw: 'Supra 3.0', trimCandidates: ['3.0'], body: 'Coupe', drive: 'RWD', engine: '3.0L I6', fuel: 'Gasoline', doors: 2, plant: 'Graz, Austria', checkDigitValid: true },
} satisfies Record<string, s.DecodedSpecs>;

const range = (v: number, pct = 0.075) => ({ value: v, low: Math.round((v * (1 - pct)) / 10) * 10, high: Math.round((v * (1 + pct)) / 10) * 10 });
const slug = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');

async function resolveUser(db: Db) {
  const email = process.env.SEED_USER_EMAIL;
  if (email) {
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
    if (!u) throw new Error('SEED_USER_EMAIL has no user yet. Sign in with Google once, then rerun.');
    return u;
  }
  await db.delete(s.users).where(eq(s.users.email, DEMO_EMAIL));
  const [u] = await db.insert(s.users).values({ name: 'Demo Driver', email: DEMO_EMAIL, timeZone: 'America/Chicago' }).returning();
  return u!;
}

export async function seed(db: Db) {
  const user = await resolveUser(db);
  for (const t of [s.alerts, s.priceWatches, s.marketWatches, s.buyChecks, s.appraisals, s.vehicles] as const) {
    await db.delete(t).where(eq(t.userId, user.id));
  }
  await db.update(s.users).set({ nextReportSeq: 0 }).where(eq(s.users.id, user.id));

  const [mustang, mx5, supra] = await db.insert(s.vehicles).values([
    { userId: user.id, vin: '1FA6P8CF9K5123456', specs: specs.mustang, trim: 'GT', modelKey: modelKey('Ford', 'Mustang', 'GT'), zip: '60601', odometer: 38200, nickname: 'Mustang GT', purchasePrice: 31500, purchaseDate: '2025-03-02', purchaseOdometer: 21000, lastPrivateValue: 27450, lastAppraisedAt: new Date('2026-11-12T15:00:00Z') },
    { userId: user.id, vin: 'JM1NDAM75H0000000', specs: specs.mx5, trim: 'Grand Touring', modelKey: modelKey('Mazda', 'MX-5', 'Grand Touring'), zip: '60614', odometer: 51900, nickname: 'MX-5 RF', lastPrivateValue: 19800, lastAppraisedAt: new Date('2026-11-12T15:05:00Z') },
    { userId: user.id, vin: 'WZ1DB4C07LW000000', specs: specs.supra, trim: '3.0', modelKey: modelKey('Toyota', 'Supra', '3.0'), zip: '60601', odometer: 22400, nickname: 'GR Supra', lastPrivateValue: 41200, lastAppraisedAt: new Date('2026-11-12T15:10:00Z') },
  ]).returning();

  // Odometer history (drives miles-per-month).
  await db.insert(s.odometerReadings).values([
    { vehicleId: mustang!.id, miles: 21000, recordedOn: '2025-03-02', source: 'purchase' },
    { vehicleId: mustang!.id, miles: 36900, recordedOn: '2026-09-14', source: 'service' },
    { vehicleId: mustang!.id, miles: 37400, recordedOn: '2026-10-03', source: 'service' },
    { vehicleId: mustang!.id, miles: 38200, recordedOn: '2026-11-12', source: 'appraisal' },
    { vehicleId: mx5!.id, miles: 49300, recordedOn: '2026-06-02', source: 'service' },
    { vehicleId: mx5!.id, miles: 50800, recordedOn: '2026-08-21', source: 'service' },
    { vehicleId: mx5!.id, miles: 51900, recordedOn: '2026-11-12', source: 'appraisal' },
    { vehicleId: supra!.id, miles: 20600, recordedOn: '2026-07-09', source: 'service' },
    { vehicleId: supra!.id, miles: 21900, recordedOn: '2026-10-28', source: 'service' },
    { vehicleId: supra!.id, miles: 22400, recordedOn: '2026-11-12', source: 'appraisal' },
  ]);

  // Appraisal history: Activity page AQ-10A..10D, plus current values shown in the Garage.
  const appraisal = (v: typeof mustang, seq: number, vin: string, sp: s.DecodedSpecs, trim: string, zip: string, mileage: number, priv: number, at: string, route: 'private' | 'instant' = 'private') => ({
    userId: user.id, vehicleId: v!.id, shareSlug: slug(), reportSeq: seq,
    inputs: { vin, trim, mileage, zip, condition: 'good', title: 'clean', accidents: 'none', serviceHistory: 'full', owners: 1, keys: 'two', warningLights: 'none' } as s.AppraisalInputs,
    specs: sp,
    privateValue: range(priv), instantValue: range(Math.round(priv * (1 + cfg.spreads.instant) / 10) * 10), retailValue: range(Math.round(priv * (1 + cfg.spreads.retail) / 10) * 10),
    adjustments: [{ key: 'demo', label: 'Demo seed', amount: 0, reason: 'Seeded from design mock data.' }],
    compStats: { found: 24, used: 21, excluded: 3, median: priv, weightedMedian: priv, avgMiles: mileage, radiusMiles: 100 },
    route, methodVersion: 'seed', createdAt: new Date(at),
  });
  await db.insert(s.appraisals).values([
    appraisal(supra, 0, supra!.vin, specs.supra, '3.0', '60601', 21000, 42300, '2026-07-20T15:00:00Z'),
    appraisal(mx5, 1, mx5!.vin, specs.mx5, 'Grand Touring', '60614', 50900, 20200, '2026-08-02T15:00:00Z', 'instant'),
    appraisal(mustang, 2, mustang!.vin, specs.mustang, 'GT', '60601', 36900, 26850, '2026-09-14T15:00:00Z'),
    appraisal(mustang, 3, mustang!.vin, specs.mustang, 'GT', '60601', 38200, 27450, '2026-11-12T15:00:00Z'),
    appraisal(mx5, 4, mx5!.vin, specs.mx5, 'Grand Touring', '60614', 51900, 19800, '2026-11-12T15:05:00Z'),
    appraisal(supra, 5, supra!.vin, specs.supra, '3.0', '60601', 22400, 41200, '2026-11-12T15:10:00Z'),
  ]);
  await db.update(s.users).set({ nextReportSeq: 6 }).where(eq(s.users.id, user.id));

  // Documents (renewals feed the calendar and alerts).
  await db.insert(s.documents).values([
    { vehicleId: mustang!.id, kind: 'title', label: 'Title (clean)' },
    { vehicleId: mustang!.id, kind: 'registration', label: 'Registration', expiresOn: '2026-12-22' },
    { vehicleId: mustang!.id, kind: 'insurance', label: 'Insurance card', expiresOn: '2027-05-31' },
    { vehicleId: mx5!.id, kind: 'insurance', label: 'Insurance card', expiresOn: '2026-11-24' },
  ]);

  // Service log (done) and calendar (scheduled), from Garage-Maintenance.dc.html.
  const done = (v: typeof mustang, type: string, title: string, date: string, odometer: number, cost: number, shop: string) =>
    ({ vehicleId: v!.id, type, title, date, odometer, costCents: cost * 100, shop, status: 'done' as const, completedAt: new Date(`${date}T18:00:00Z`) });
  const sched = (v: typeof mustang, type: string, title: string, date: string) => ({ vehicleId: v!.id, type, title, date, status: 'scheduled' as const });
  await db.insert(s.serviceEvents).values([
    done(supra, 'oil_filter', 'Oil + filter', '2026-10-28', 21900, 118, 'Dealer'),
    done(mustang, 'brake_pads', 'Front brake pads', '2026-10-03', 37400, 386, 'Independent shop'),
    done(mustang, 'tire_rotation', 'Tire rotation', '2026-09-14', 36900, 40, 'Independent shop'),
    done(mx5, 'oil_filter', 'Oil + filter', '2026-08-21', 50800, 74, 'DIY'),
    done(supra, 'detail', 'Detail + wax', '2026-07-09', 20600, 220, 'Detailer'),
    done(mx5, 'tires', 'New tires (4)', '2026-06-02', 49300, 612, 'Tire shop'),
    sched(mx5, 'brake_fluid', 'Brake fluid flush', '2026-11-09'),
    sched(mustang, 'oil_filter', 'Oil + filter', '2026-11-18'),
    sched(supra, 'tire_rotation', 'Tire rotation', '2026-11-20'),
    sched(supra, 'inspection', 'State inspection', '2026-11-30'),
    sched(supra, 'wipers', 'Wiper blades', '2026-12-04'),
    sched(mustang, 'tire_rotation', 'Tire rotation', '2026-12-09'),
    sched(mx5, 'coolant', 'Coolant check', '2026-12-15'),
    sched(supra, 'oil_filter', 'Oil + filter', '2026-12-18'),
    sched(mx5, 'oil_filter', 'Oil + filter', '2027-01-08'),
    sched(mustang, 'cabin_filter', 'Cabin air filter', '2027-01-19'),
  ]);

  // Mileage-based intervals shown under "By mileage" (oil 40,000 / tires 55,000 / pads 30,000 targets).
  await db.insert(s.serviceIntervals).values([
    { vehicleId: mustang!.id, type: 'oil_filter', title: 'Oil + filter', everyMiles: 7500, everyMonths: 12, source: 'user' },
    { vehicleId: mx5!.id, type: 'tires', title: 'Tires', everyMiles: 40000, source: 'user' },
    { vehicleId: supra!.id, type: 'brake_pads', title: 'Brake pads', everyMiles: 30000, source: 'user' },
  ]);

  // Recall check: real NHTSA response recorded for 2019 Ford Mustang (model-year basis).
  const recalls = JSON.parse(readFileSync('tests/fixtures/nhtsa/recalls_ford_mustang_2019.json', 'utf8')).results.map(mapRecall);
  await db.insert(s.recallChecks).values({ vehicleId: mustang!.id, basis: 'model_year', results: recalls, checkedAt: new Date('2026-11-09T10:00:00Z') });

  // Price watch (Value tracker "Tell me if the value drops below $26,000").
  await db.insert(s.priceWatches).values({ userId: user.id, vehicleId: mustang!.id, threshold: 26000, direction: 'below', lastValue: 27450 });

  // Saved buy checks (Buy page compare table). Demo VINs.
  const buySpecs = { ...specs.mustang, year: 2018 };
  const verdict = (lo: number, hi: number, v: 'below' | 'fair' | 'above', offer: number) => ({ fairLow: lo, fairHigh: hi, mid: (lo + hi) / 2, verdict: v, suggestedOffer: offer, compCount: 24, computedAt: '2026-11-07T15:00:00Z' });
  const [watchedBuy] = await db.insert(s.buyChecks).values([
    { userId: user.id, vin: '1FA6P8CF2J5000001', specs: buySpecs, trim: 'GT', zip: '60601', askingPrice: 28900, mileage: 46100, sellerType: 'dealer', verdict: verdict(28600, 31200, 'fair', 28200) },
    { userId: user.id, vin: '1FA6P8CF2K5000002', specs: specs.mustang, trim: 'GT', zip: '60601', askingPrice: 26400, mileage: 52300, sellerType: 'private', verdict: verdict(24900, 28400, 'fair', 25700) },
    { userId: user.id, vin: '1FA6P8CF6J5000003', specs: buySpecs, trim: 'GT', zip: '60601', askingPrice: 31900, mileage: 33800, sellerType: 'dealer', verdict: verdict(28600, 31200, 'above', 29600) },
  ]).returning();
  await db.insert(s.priceWatches).values({ userId: user.id, buyCheckId: watchedBuy!.id, threshold: 28000, direction: 'below', lastValue: 28400 });
  await db.insert(s.marketWatches).values({ userId: user.id, modelKey: mustang!.modelKey, zip: '60601', radiusMiles: 100, thresholdPct: 3, baselineMedian: 27900 });

  // Alerts inbox (Alerts.dc.html). The first three are unread.
  const at = (iso: string) => new Date(iso);
  await db.insert(s.alerts).values([
    { userId: user.id, type: 'recall', vehicleId: mustang!.id, title: 'New recall notice to review', body: `${recalls[0]?.component ?? 'Recall'}: may apply to your model year. Confirm with your VIN at nhtsa.gov/recalls.`, link: `/garage/${mustang!.id}`, dedupeKey: `recall:${mustang!.id}:${recalls[0]?.campaign ?? 'seed'}`, createdAt: at('2026-11-12T13:00:00Z') },
    { userId: user.id, type: 'maintenance', vehicleId: mx5!.id, title: 'Brake fluid flush is 3 days overdue', body: 'MX-5 RF, was due Nov 9.', link: '/garage/maintenance', dedupeKey: 'seed:maint:mx5-brake-fluid', createdAt: at('2026-11-12T09:00:00Z') },
    { userId: user.id, type: 'value', vehicleId: mustang!.id, title: 'Mustang GT is up $600', body: 'Private value is now $27,450 (Rev D).', link: `/garage/${mustang!.id}/value`, dedupeKey: 'seed:value:mustang-2026-11-12', createdAt: at('2026-11-12T09:00:00Z') },
    { userId: user.id, type: 'renewal', vehicleId: mx5!.id, title: 'Insurance renews Nov 24', body: 'MX-5 RF. Upload the new card when it arrives.', link: `/garage/${mx5!.id}`, dedupeKey: 'seed:renew:mx5-insurance', readAt: at('2026-11-11T20:00:00Z'), createdAt: at('2026-11-11T09:00:00Z') },
    { userId: user.id, type: 'market', vehicleId: mustang!.id, title: 'Mustang GT listings up 12% near you', body: 'More supply usually softens prices. Median asking $27,900.', link: '/market', dedupeKey: 'seed:market:mustang-2026-11-09', readAt: at('2026-11-09T20:00:00Z'), createdAt: at('2026-11-09T09:00:00Z') },
    { userId: user.id, type: 'price_target', vehicleId: null, title: 'A car you are watching dropped $500', body: '2018 Mustang GT, now $28,400. Still in the fair range.', link: '/buy', dedupeKey: 'seed:price:buy-1', readAt: at('2026-11-07T20:00:00Z'), createdAt: at('2026-11-07T09:00:00Z') },
  ]);

  return { userId: user.id, vehicles: 3 };
}

// Run when executed directly (not when imported by tests).
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/seed.ts')) {
  seed(getDb())
    .then((r) => {
      console.log(`Seeded demo garage: ${r.vehicles} vehicles.`);
      process.exit(0);
    })
    .catch((e) => {
      console.error('Seed failed:', e instanceof Error ? (e as { cause?: Error }).cause?.message ?? e.message : e);
      process.exit(1);
    });
}
