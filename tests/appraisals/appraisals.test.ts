import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createUser } from '../helpers/db';
import { useFixtureProviders, fixtureProviders, FIXTURE_VINS } from '../helpers/providers';
import { setProviders } from '@/models/providers';
import { setTestUser } from '@/models/session';
import type { Db } from '@/models/db';
import { appraisals, comps, odometerReadings, saleOutcomes, users, vehicles } from '@/models/db/schema';
import { withValidCheckDigit } from '@/shared/vin';
import { valuationConfig } from '@/models/config/valuation';
import { modelKey } from '@/shared/model-key';
import {
  reportCode, purgeExpiredAnonymousAppraisals, refreshVehicleValue, latestAppraisal, appraiseAndSave,
} from '@/models/appraisals';
import { POST as decodePOST } from '@/app/api/vin/decode/route';
import { POST as appraisePOST, GET as appraiseGET } from '@/app/api/appraisals/route';
import { GET as reportGET } from '@/app/api/reports/[slug]/route';
import { POST as claimPOST } from '@/app/api/reports/[slug]/claim/route';
import { POST as refreshPOST } from '@/app/api/vehicles/[id]/refresh-value/route';
import { POST as outcomePOST } from '@/app/api/appraisals/[id]/outcome/route';

// Legacy route fixtures intentionally have no reference snapshot. Model persistence has separate tests.
vi.mock('@/models/reference', async (original) => ({ ...await original<typeof import('@/models/reference')>(), loadReferences: () => ({ msrp: [], generations: [], variants: [], cpi: null }) }));

const post = (url: string, body: unknown) =>
  new Request(`http://test${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (url: string) => new Request(`http://test${url}`);
const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });

const mustang = {
  vin: FIXTURE_VINS.mustang2019, trim: 'GT', mileage: 38200, zip: '60601', condition: 'good', title: 'clean', accidents: 'none',
};

let db: Db;
let savedKey: string | undefined;

beforeEach(async () => {
  db = await createTestDb();
  useFixtureProviders();
  savedKey = process.env.MARKETCHECK_API_KEY;
});
afterEach(() => {
  setProviders(null);
  if (savedKey === undefined) delete process.env.MARKETCHECK_API_KEY;
  else process.env.MARKETCHECK_API_KEY = savedKey;
});

async function seedVehicle(userId: string, vin: string = FIXTURE_VINS.mustang2019, over: Partial<typeof vehicles.$inferInsert> = {}) {
  const d = await fixtureProviders().vin.decode(vin);
  const { vin: _v, warnings: _w, raw: _r, ...specs } = d as typeof d & { raw?: unknown };
  const [v] = await db.insert(vehicles).values({
    userId, vin, specs, trim: 'GT', modelKey: modelKey(specs.make, specs.model, 'GT'), zip: '60601', odometer: 30000, ...over,
  }).returning();
  return v!;
}

describe('reportCode', () => {
  it('maps sequence numbers to AQ codes', () => {
    expect([0, 1, 25, 26, 27, 52].map(reportCode)).toEqual(['AQ-10A', 'AQ-10B', 'AQ-10Z', 'AQ-11A', 'AQ-11B', 'AQ-12A']);
  });
});

describe('POST /api/vin/decode', () => {
  it('decodes the Mustang with one trim candidate', async () => {
    const res = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.mustang2019.toLowerCase() }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b).toMatchObject({ vin: FIXTURE_VINS.mustang2019, year: 2019, make: 'Ford', model: 'Mustang', trimCandidates: ['GT'], needsTrimChoice: false, needsConfirmation: false });
    expect(b.specs.raw).toBeUndefined();
  });

  it('flags a multi-trim Camry', async () => {
    const b = await (await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.camry2018 }))).json();
    expect(b).toMatchObject({ trimCandidates: ['L', 'LE', 'SE', 'XLE'], needsTrimChoice: true });
  });

  it('rejects a bad check digit unless imported', async () => {
    const res = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.badCheckDigit }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.vin[0]).toMatch(/Check character 9 should be 9/);
    const ok = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.badCheckDigit, importedVehicle: true }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).warnings).toContain('check_digit_mismatch_imported');
  });

  it('400 on malformed, 422 when vPIC cannot decode, 502 on upstream failure', async () => {
    expect((await decodePOST(post('/api/vin/decode', { vin: 'SHORT' }))).status).toBe(400);
    const r422 = await decodePOST(post('/api/vin/decode', { vin: withValidCheckDigit('ZZZZZZZZZZZZZZZZZ') }));
    expect(r422.status).toBe(422);
    expect((await r422.json()).error.code).toBe('vin_not_decoded');
    useFixtureProviders({ vinFailure: { status: 500 } });
    const r502 = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.rav42021 }));
    expect(r502.status).toBe(502);
    expect((await r502.json()).error).toMatchObject({ code: 'upstream_failed', provider: 'NHTSA vPIC', upstreamStatus: 500 });
  });
});

describe('POST /api/appraisals', () => {
  it('happy path: 2019 Mustang GT, 38,200 mi, 60601 (signed in)', async () => {
    const u = await createUser(db);
    setTestUser(u.id);
    const res = await appraisePOST(post('/api/appraisals', mustang));
    expect(res.status).toBe(201);
    const r = await res.json();
    expect(r.code).toBe('AQ-10A');
    expect(r.saved).toBe(true);
    expect(r.expiresOn).toBeNull();
    expect(r.vehicle.label).toBe('2019 Ford Mustang GT');
    expect(r.mileage).toBe(38200);
    expect(r.private.low).toBeLessThan(r.private.value);
    expect(r.instant.value).toBeLessThan(r.private.value);
    expect(r.retail.value).toBeGreaterThan(r.private.value);
    expect(r.adjustments.map((a: { key: string }) => a.key)).toEqual(['mileage', 'regional', 'condition', 'accidents', 'title']);
    expect(r.adjustments[0].label).toMatch(/^Mileage, 38,200 vs [\d,]+ average$/);
    expect(r.base.amount + r.adjustments.reduce((a: number, x: { amount: number }) => a + x.amount, 0)).toBe(r.private.value);
    const privateMode = r.compStats.privateComps >= valuationConfig.minPrivateComps;
    expect(r.base.label).toBe(privateMode ? `Weighted median of ${r.compStats.privateComps} private-seller listings` : `Weighted median of ${r.compStats.used} comparable listings`);
    expect(r.compStats.summary).toMatch(/^\d+ comparable listings within 100 miles$/);
    expect(r.comps[0]).toMatchObject({ weightLabel: expect.stringMatching(/High|Med|Low/) });
    expect(r.confidence).toMatchObject({ decodeStatus: 'clean', trimConfirmedByUser: true, searchTier: 1 });
    expect(r.methodNotes).toContain("Not an offer. A buyer's inspection decides.");
    expect(r.methodVersion).toBeTruthy();
    // Persisted: comps keyed by listing id, never a VIN.
    const rows = await db.select().from(comps).where(eq(comps.appraisalId, r.id));
    expect(rows.length).toBe(r.comps.length);
    expect(JSON.stringify(rows)).not.toMatch(/TEST[A-Z0-9]{13}/);
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0]!.nextReportSeq).toBe(1);
  });

  it('values the 2018 Camry in 60601 and the 2021 RAV4 in 94538 (old app returned 404)', async () => {
    const camry = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.camry2018, trim: 'LE', mileage: 52000 }));
    expect(camry.status).toBe(201);
    expect((await camry.json()).vehicle.label).toBe('2018 Toyota Camry LE');
    const rav = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.rav42021, trim: null, mileage: 21000, zip: '94538' }));
    expect(rav.status).toBe(201);
    const r = await rav.json();
    expect(r.vehicle.label).toBe('2021 Toyota RAV4 XLE');
    expect(r.confidence.trimConfirmedByUser).toBe(false);
  });

  it('multi-trim VIN without a trim -> 400 with candidates', async () => {
    const res = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.camry2018, trim: null }));
    expect(res.status).toBe(400);
    const e = (await res.json()).error;
    expect(e.code).toBe('invalid_input');
    expect(e.fields.trim).toBeTruthy();
    expect(e.trimCandidates).toEqual(['L', 'LE', 'SE', 'XLE']);
  });

  it('field errors are 400, never 500', async () => {
    const big = await appraisePOST(post('/api/appraisals', { ...mustang, mileage: 6500045000 }));
    expect(big.status).toBe(400);
    expect((await big.json()).error.fields.mileage).toBeTruthy();
    const { zip: _z, ...noZip } = mustang;
    const nz = await appraisePOST(post('/api/appraisals', noZip));
    expect(nz.status).toBe(400);
    expect((await nz.json()).error.fields.zip).toBeTruthy();
    const badEnum = await appraisePOST(post('/api/appraisals', { ...mustang, condition: 'mint' }));
    expect((await badEnum.json()).error.fields.condition).toBeTruthy();
    const badCheck = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.badCheckDigit }));
    expect(badCheck.status).toBe(400);
    expect((await badCheck.json()).error.fields.vin).toBeTruthy();
    const imported = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.badCheckDigit, importedVehicle: true }));
    expect(imported.status).toBe(201);
  });

  it.each([
    [{ status: 401 }, 401],
    [{ status: 429 }, 429],
    ['network' as const, null],
  ])('upstream failure %j -> model or friendly missing-anchor response', async (failure, upstreamStatus) => {
    useFixtureProviders({ listingsFailure: failure });
    const res = await appraisePOST(post('/api/appraisals', mustang));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', reason: 'needs_reference' });
  });

  it('friendly missing-anchor response without a MarketCheck key', async () => {
    const f = fixtureProviders();
    setProviders({ vin: f.vin, recalls: f.recalls });
    delete process.env.MARKETCHECK_API_KEY;
    const res = await appraisePOST(post('/api/appraisals', mustang));
    expect(res.status).toBe(422);
    expect((await res.json()).error.reason).toBe('needs_reference');
  });

  it('too few comps without an anchor -> 422, and no report number is used', async () => {
    const u = await createUser(db);
    setTestUser(u.id);
    const f = fixtureProviders();
    const vin = withValidCheckDigit('SCCLMDTU0PH000000');
    const mx = await f.vin.decode(FIXTURE_VINS.mustang2019);
    setProviders({
      ...f,
      vin: { decode: async () => ({ ...mx, vin, year: 2023, make: 'Lotus', model: 'Emira', trimRaw: 'V6', trimCandidates: ['V6'] }) },
    });
    const res = await appraisePOST(post('/api/appraisals', { ...mustang, vin, trim: 'V6', mileage: 4000 }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatchObject({ code: 'invalid_input', reason: 'needs_reference' });
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0]!.nextReportSeq).toBe(0);
    expect(await db.select().from(appraisals)).toHaveLength(0);
  });

  it('ownership: other user vehicle 404, anonymous with vehicleId 401, VIN mismatch 400', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const vb = await seedVehicle(b.id);
    setTestUser(a.id);
    expect((await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: vb.id }))).status).toBe(404);
    setTestUser(null);
    expect((await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: vb.id }))).status).toBe(401);
    setTestUser(b.id);
    const mis = await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.rav42021, vehicleId: vb.id }));
    expect(mis.status).toBe(400);
    expect((await mis.json()).error.fields.vin).toBeTruthy();
  });

  it('own vehicle: updates value, raises odometer, records a reading', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id);
    setTestUser(u.id);
    const r = await (await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: v.id }))).json();
    const [after] = await db.select().from(vehicles).where(eq(vehicles.id, v.id));
    expect(after!.lastPrivateValue).toBe(r.private.value);
    expect(after!.odometer).toBe(38200);
    const reads = await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, v.id));
    expect(reads).toMatchObject([{ miles: 38200, source: 'appraisal' }]);
    // Lower mileage never lowers the odometer.
    const low = await (await appraisePOST(post('/api/appraisals', { ...mustang, mileage: 20000, vehicleId: v.id }))).json();
    expect((await db.select().from(vehicles).where(eq(vehicles.id, v.id)))[0]!.odometer).toBe(38200);
    // No backwards reading; the report carries a flag instead.
    expect(await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, v.id))).toHaveLength(1);
    expect(low.confidence.flags).toContain('mileage_below_last_reading');
    expect(r.confidence.flags).not.toContain('mileage_below_last_reading');
    expect((await latestAppraisal(db, v.id))!.inputs.mileage).toBe(20000);
  });
});

describe('codes, activity, share, claim, purge', () => {
  it('assigns sequential codes per user and lists activity newest first with change', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id);
    setTestUser(u.id);
    const r1 = await (await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: v.id }))).json();
    const r2 = await (await appraisePOST(post('/api/appraisals', { ...mustang, vin: FIXTURE_VINS.rav42021, trim: null, zip: '94538', route: 'instant' }))).json();
    const r3 = await (await appraisePOST(post('/api/appraisals', { ...mustang, mileage: 45000, condition: 'fair', vehicleId: v.id }))).json();
    expect([r1.code, r2.code, r3.code]).toEqual(['AQ-10A', 'AQ-10B', 'AQ-10C']);

    const list = (await (await appraiseGET(get('/api/appraisals'))).json()).items;
    expect(list.map((i: { code: string }) => i.code)).toEqual(['AQ-10C', 'AQ-10B', 'AQ-10A']);
    expect(list[0]).toMatchObject({ vehicle: '2019 Ford Mustang GT', route: 'private', value: r3.private.value, change: r3.private.value - r1.private.value, shareSlug: r3.slug });
    expect(list[1]).toMatchObject({ route: 'instant', value: r2.instant.value, change: null });
    expect(list[2].change).toBeNull();
    expect(list[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const byVehicle = (await (await appraiseGET(get(`/api/appraisals?vehicleId=${v.id}`))).json()).items;
    expect(byVehicle).toHaveLength(2);
    const other = await createUser(db);
    setTestUser(other.id);
    expect((await appraiseGET(get(`/api/appraisals?vehicleId=${v.id}`))).status).toBe(404);
    setTestUser(null);
    expect((await appraiseGET(get('/api/appraisals'))).status).toBe(401);
  });

  it('public report hides ids; 404 for unknown and expired', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id);
    setTestUser(u.id);
    const r = await (await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: v.id }))).json();
    expect(r.slug).toMatch(/^[0-9A-Za-z]{10}$/);
    setTestUser(null);
    const res = await reportGET(get(`/api/reports/${r.slug}`), ctx({ slug: r.slug }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(u.id);
    expect(text).not.toContain(v.id);
    expect(text).not.toContain(r.id);
    expect(text).not.toMatch(/"(userId|vehicleId|id)"/);
    const pub = JSON.parse(text);
    expect(pub).toMatchObject({ code: 'AQ-10A', vin: FIXTURE_VINS.mustang2019, zip: '60601', private: r.private });
    expect((await reportGET(get('/api/reports/nope123456'), ctx({ slug: 'nope123456' }))).status).toBe(404);

    const anon = await appraiseAndSave(db, fixtureProviders(), {
      userId: null, inputs: { ...mustang, condition: 'good', title: 'clean', accidents: 'none', serviceHistory: null, owners: null, keys: null, warningLights: null },
      now: new Date('2020-01-01T00:00:00Z'),
    });
    expect((await reportGET(get(`/api/reports/${anon.slug}`), ctx({ slug: anon.slug }))).status).toBe(404);
  });

  it('anonymous appraisals expire and are purged; saved ones stay', async () => {
    const u = await createUser(db);
    setTestUser(null);
    const anon = await (await appraisePOST(post('/api/appraisals', mustang))).json();
    expect(anon.code).toBeNull();
    expect(anon.saved).toBe(false);
    expect(anon.expiresOn).toBeTruthy();
    setTestUser(u.id);
    await appraisePOST(post('/api/appraisals', mustang));
    expect(await purgeExpiredAnonymousAppraisals(db, new Date())).toBe(0);
    expect(await purgeExpiredAnonymousAppraisals(db, new Date(Date.now() + 91 * 86_400_000))).toBe(1);
    const left = await db.select().from(appraisals);
    expect(left).toHaveLength(1);
    expect(left[0]!.userId).toBe(u.id);
    expect(await db.select().from(comps).where(eq(comps.appraisalId, anon.id))).toHaveLength(0);
  });

  it('claim flow: anonymous report saved to the signed-in user', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    setTestUser(null);
    const anon = await (await appraisePOST(post('/api/appraisals', mustang))).json();
    expect((await claimPOST(post(`/api/reports/${anon.slug}/claim`, {}), ctx({ slug: anon.slug }))).status).toBe(401);
    setTestUser(a.id);
    await appraisePOST(post('/api/appraisals', mustang)); // AQ-10A
    const claimed = await (await claimPOST(post(`/api/reports/${anon.slug}/claim`, {}), ctx({ slug: anon.slug }))).json();
    expect(claimed).toMatchObject({ code: 'AQ-10B', saved: true, expiresOn: null });
    const again = await claimPOST(post(`/api/reports/${anon.slug}/claim`, {}), ctx({ slug: anon.slug }));
    expect(again.status).toBe(200);
    expect((await again.json()).code).toBe('AQ-10B');
    setTestUser(b.id);
    const taken = await claimPOST(post(`/api/reports/${anon.slug}/claim`, {}), ctx({ slug: anon.slug }));
    expect(taken.status).toBe(409);
    expect((await claimPOST(post('/api/reports/zzzzzzzzzz/claim', {}), ctx({ slug: 'zzzzzzzzzz' }))).status).toBe(404);
  });
});

describe('refresh and outcomes', () => {
  it('refresh-value reuses the last answers with the current odometer', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id);
    setTestUser(u.id);
    await appraisePOST(post('/api/appraisals', { ...mustang, condition: 'fair', accidents: 'minor', vehicleId: v.id, route: 'instant' }));
    await db.update(vehicles).set({ odometer: 41000 }).where(eq(vehicles.id, v.id));
    const res = await refreshPOST(post(`/api/vehicles/${v.id}/refresh-value`, {}), ctx({ id: v.id }));
    expect(res.status).toBe(201);
    const r = await res.json();
    expect(r).toMatchObject({ code: 'AQ-10B', mileage: 41000, route: 'instant' });
    expect(r.adjustments.find((a: { key: string }) => a.key === 'condition').label).toBe('Condition, fair');
    expect(await db.select().from(odometerReadings).where(eq(odometerReadings.vehicleId, v.id))).toHaveLength(1);
    const other = await createUser(db);
    setTestUser(other.id);
    expect((await refreshPOST(post(`/api/vehicles/${v.id}/refresh-value`, {}), ctx({ id: v.id }))).status).toBe(404);
  });

  it('refreshVehicleValue works without prior appraisals or a confirmed trim (job path)', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id, FIXTURE_VINS.camry2018, { trim: null, modelKey: 'toyota|camry|' });
    const r = await refreshVehicleValue(db, fixtureProviders(), v.id);
    expect(r.confidence).toMatchObject({ trimConfirmedByUser: false });
    expect(r.confidence!.rangeReasons).toContain('Trim not confirmed.');
    expect((await db.select().from(vehicles).where(eq(vehicles.id, v.id)))[0]!.lastPrivateValue).toBe(r.private.value);
  });

  it('records a sale outcome on an owned appraisal (one per vehicle)', async () => {
    const u = await createUser(db);
    const v = await seedVehicle(u.id);
    setTestUser(u.id);
    const r = await (await appraisePOST(post('/api/appraisals', { ...mustang, vehicleId: v.id }))).json();
    const body = { soldPrice: '$26,900', route: 'private', soldOn: '2026-11-10' };
    const res = await outcomePOST(post(`/api/appraisals/${r.id}/outcome`, body), ctx({ id: r.id }));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ soldPrice: 26900, route: 'private', soldOn: '2026-11-10' });
    await outcomePOST(post(`/api/appraisals/${r.id}/outcome`, { ...body, soldPrice: 27100 }), ctx({ id: r.id }));
    const rows = await db.select().from(saleOutcomes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.soldPrice).toBe(27100);
    expect((await outcomePOST(post(`/api/appraisals/${r.id}/outcome`, { ...body, soldOn: 'yesterday' }), ctx({ id: r.id }))).status).toBe(400);
    const other = await createUser(db);
    setTestUser(other.id);
    expect((await outcomePOST(post(`/api/appraisals/${r.id}/outcome`, body), ctx({ id: r.id }))).status).toBe(404);
  });
});

