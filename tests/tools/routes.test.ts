import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createUser } from '../helpers/db';
import { useFixtureProviders, FIXTURE_VINS } from '../helpers/providers';
import { setTestUser } from '@/lib/session';
import type { Db } from '@/lib/db';
import { GET as valueGET } from '@/app/api/vehicles/[id]/value/route';
import { POST as sellPOST } from '@/app/api/vehicles/[id]/sell-plan/route';
import { POST as priceCheckPOST } from '@/app/api/price-check/route';
import { GET as buyListGET, POST as buyPOST } from '@/app/api/buy-checks/route';
import { DELETE as buyDELETE } from '@/app/api/buy-checks/[id]/route';
import { GET as compareGET } from '@/app/api/buy-checks/compare/route';
import { GET as marketGET } from '@/app/api/market/route';
import { GET as pwGET, POST as pwPOST } from '@/app/api/price-watches/route';
import { DELETE as pwDELETE } from '@/app/api/price-watches/[id]/route';
import { GET as mwGET, POST as mwPOST } from '@/app/api/market-watches/route';
import { DELETE as mwDELETE } from '@/app/api/market-watches/[id]/route';
import { createAppraisal, createVehicle, ctx, jsonReq } from './helpers';

let db: Db;
let owner: string;
let stranger: string;
let vehicleId: string;

beforeEach(async () => {
  db = await createTestDb();
  useFixtureProviders();
  owner = (await createUser(db)).id;
  stranger = (await createUser(db)).id;
  const v = await createVehicle(db, owner, { lastPrivateValue: 27450 });
  vehicleId = v.id;
  await createAppraisal(db, owner, v.id, { privateValue: 27450, instantValue: 23100, createdAt: new Date('2026-11-01T12:00:00Z') });
}, 60000);

describe('user-scoped routes: auth + ownership', () => {
  it('value tracker: 401 signed out, 404 for another user, 200 for owner, 400 bad milesPerYear', async () => {
    setTestUser(null);
    expect((await valueGET(jsonReq(`/api/vehicles/${vehicleId}/value`, 'GET'), ctx({ id: vehicleId }))).status).toBe(401);
    setTestUser(stranger);
    expect((await valueGET(jsonReq(`/api/vehicles/${vehicleId}/value`, 'GET'), ctx({ id: vehicleId }))).status).toBe(404);
    setTestUser(owner);
    const ok = await valueGET(jsonReq(`/api/vehicles/${vehicleId}/value?milesPerYear=10000`, 'GET'), ctx({ id: vehicleId }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.milesPerYear).toBe(10000);
    expect(body.forecast).toHaveLength(12);
    expect(body.bestMonthToSell.month).toMatch(/^\d{4}-\d{2}$/);
    const bad = await valueGET(jsonReq(`/api/vehicles/${vehicleId}/value?milesPerYear=70000`, 'GET'), ctx({ id: vehicleId }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.fields.milesPerYear).toBeTruthy();
  });

  it('sell plan: 404 for another user, loanPayoff defaults to 0, rejects a bad amount', async () => {
    setTestUser(stranger);
    expect((await sellPOST(jsonReq(`/x`, 'POST', { loanPayoff: 0 }), ctx({ id: vehicleId }))).status).toBe(404);
    setTestUser(owner);
    const noLoan = await sellPOST(jsonReq(`/x`, 'POST', {}), ctx({ id: vehicleId }));
    expect(noLoan.status).toBe(200);
    expect((await noLoan.json()).loanPayoff).toBe(0);
    expect((await sellPOST(jsonReq(`/x`, 'POST', { loanPayoff: -5 }), ctx({ id: vehicleId }))).status).toBe(400);
    const res = await sellPOST(jsonReq(`/x`, 'POST', { loanPayoff: '$5,000' }), ctx({ id: vehicleId }));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.routes.map((r: { key: string }) => r.key)).toEqual(['instant', 'trade', 'private']);
    expect(b.disclaimer).toBe('Not tax or legal advice.');
    expect(b.stateRulesAvailable).toBe(false);
  });

  it('price watches: create/list/delete scoped to the owner', async () => {
    setTestUser(stranger);
    expect((await pwPOST(jsonReq('/x', 'POST', { vehicleId, threshold: 26000, direction: 'below' }), ctx())).status).toBe(404);
    setTestUser(owner);
    const created = await pwPOST(jsonReq('/x', 'POST', { vehicleId, threshold: 26000, direction: 'below' }), ctx());
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await (await pwGET(jsonReq('/x', 'GET'), ctx())).json()).items).toHaveLength(1);
    setTestUser(stranger);
    expect((await (await pwGET(jsonReq('/x', 'GET'), ctx())).json()).items).toHaveLength(0);
    expect((await pwDELETE(jsonReq('/x', 'DELETE'), ctx({ id }))).status).toBe(404);
    setTestUser(owner);
    expect((await pwDELETE(jsonReq('/x', 'DELETE'), ctx({ id }))).status).toBe(204);
  });

  it('market watches: create/list/delete scoped to the owner', async () => {
    setTestUser(owner);
    const created = await mwPOST(jsonReq('/x', 'POST', { modelKey: 'Ford|Mustang|GT', zip: '60601', radiusMiles: 50 }), ctx());
    expect(created.status).toBe(201);
    const w = await created.json();
    expect(w.modelKey).toBe('ford|mustang|gt');
    expect((await mwPOST(jsonReq('/x', 'POST', { modelKey: 'mustang', zip: '60601', radiusMiles: 50 }), ctx())).status).toBe(400);
    expect((await mwPOST(jsonReq('/x', 'POST', { modelKey: 'ford|mustang|', zip: '60601', radiusMiles: 30 }), ctx())).status).toBe(400);
    expect((await (await mwGET(jsonReq('/x', 'GET'), ctx())).json()).items).toHaveLength(1);
    setTestUser(stranger);
    expect((await mwDELETE(jsonReq('/x', 'DELETE'), ctx({ id: w.id }))).status).toBe(404);
    setTestUser(owner);
    expect((await mwDELETE(jsonReq('/x', 'DELETE'), ctx({ id: w.id }))).status).toBe(204);
  });
});

describe('market route', () => {
  it('public by modelKey+zip; vehicleId must be owned and marks your bucket', async () => {
    setTestUser(null);
    const pub = await marketGET(jsonReq('/api/market?modelKey=ford|mustang|gt&zip=60601&radius=100', 'GET'), ctx());
    expect(pub.status).toBe(200);
    const m = await pub.json();
    expect(m.buckets).toHaveLength(6);
    expect(m.yourBucketIndex).toBeNull();
    expect((await marketGET(jsonReq('/api/market?modelKey=ford|mustang|gt&zip=60601&radius=30', 'GET'), ctx())).status).toBe(400);
    expect((await marketGET(jsonReq(`/api/market?vehicleId=${vehicleId}`, 'GET'), ctx())).status).toBe(401);
    setTestUser(stranger);
    expect((await marketGET(jsonReq(`/api/market?vehicleId=${vehicleId}`, 'GET'), ctx())).status).toBe(404);
    setTestUser(owner);
    const mine = await (await marketGET(jsonReq(`/api/market?vehicleId=${vehicleId}&radius=100`, 'GET'), ctx())).json();
    expect(mine.cached).toBe(true);
    expect(mine.yourValue).toBe(27450);
    expect(typeof mine.yourBucketIndex).toBe('number');
  });
});

describe('price check + buy checks', () => {
  const body = { vin: FIXTURE_VINS.mustang2019, askingPrice: 28900, mileage: 46100, sellerType: 'dealer', zip: '60601' };

  it('public price check returns a verdict, offer and checklist', async () => {
    setTestUser(null);
    const res = await priceCheckPOST(jsonReq('/api/price-check', 'POST', body), ctx());
    const b = await res.json();
    expect(res.status, JSON.stringify(b)).toBe(200);
    expect(['below', 'fair', 'above']).toContain(b.verdict);
    expect(b.fairRange.basis).toBe('retail');
    expect(b.suggestedFirstOffer % 50).toBe(0);
    expect(b.suggestedFirstOffer).toBe(Math.max(0, Math.round(Math.min(28900 - 700, b.fairRange.mid - 300) / 50) * 50));
    expect(b.confidence).toHaveProperty('decodeStatus');
    expect(b.confidence).toHaveProperty('searchTier');
    const recall = b.checklist.find((c: { key: string }) => c.key === 'recalls');
    expect(recall.detail).toContain('may apply to this model year');
    expect(recall.count).toBeGreaterThan(0);
    expect(b.checklist.some((c: { key: string }) => c.key === 'smog')).toBe(false); // IL ZIP
    expect(b.questions).toHaveLength(5);
    expect(JSON.stringify(b)).not.toMatch(/—/);
  });

  it('price check errors: bad check digit 400, multi-trim 400 with candidates, upstream 502', async () => {
    setTestUser(null);
    const bad = await priceCheckPOST(jsonReq('/x', 'POST', { ...body, vin: FIXTURE_VINS.badCheckDigit }), ctx());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.fields.vin).toBeTruthy();
    const camry = await priceCheckPOST(jsonReq('/x', 'POST', { ...body, vin: FIXTURE_VINS.camry2018 }), ctx());
    expect(camry.status).toBe(400);
    expect((await camry.json()).error.trimCandidates).toEqual(['L', 'LE', 'SE', 'XLE']);
    useFixtureProviders({ listingsFailure: { status: 500 } });
    const up = await priceCheckPOST(jsonReq('/x', 'POST', body), ctx());
    expect(up.status).toBe(502);
  });

  it('save, list, compare, delete', async () => {
    setTestUser(null);
    expect((await buyPOST(jsonReq('/x', 'POST', body), ctx())).status).toBe(401);
    setTestUser(owner);
    const saved = await buyPOST(jsonReq('/x', 'POST', body), ctx());
    expect(saved.status).toBe(201);
    const { buyCheck } = await saved.json();
    expect(buyCheck.verdict.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const list = await (await buyListGET(jsonReq('/x', 'GET'), ctx())).json();
    expect(list.items).toHaveLength(1);
    const cmp = await compareGET(jsonReq(`/api/buy-checks/compare?ids=${buyCheck.id}`, 'GET'), ctx());
    expect((await cmp.json()).rows[0]).toMatchObject({ car: '2019 Mustang GT', miles: 46100, asking: 28900, seller: 'dealer' });
    expect((await compareGET(jsonReq('/api/buy-checks/compare?ids=a,b,c,d', 'GET'), ctx())).status).toBe(400);
    setTestUser(stranger);
    expect((await buyDELETE(jsonReq('/x', 'DELETE'), ctx({ id: buyCheck.id }))).status).toBe(404);
    setTestUser(owner);
    expect((await buyDELETE(jsonReq('/x', 'DELETE'), ctx({ id: buyCheck.id }))).status).toBe(204);
  });
});

describe('imported vehicle + buy-check revaluation', () => {
  it('importedVehicle turns a check digit mismatch into a warning', async () => {
    setTestUser(null);
    const res = await priceCheckPOST(jsonReq('/x', 'POST', {
      vin: FIXTURE_VINS.badCheckDigit, askingPrice: 28900, mileage: 46100, sellerType: 'dealer', zip: '60601', importedVehicle: true,
    }), ctx());
    const b = await res.json();
    expect(b.error?.fields?.vin).toBeUndefined();
    expect(res.status).toBe(200);
    expect(b.warnings).toContain('check_digit_mismatch_imported');
  });

  it('a watched buy check is re-valued, so its price watch can fire', async () => {
    const { revalueWatchedBuyChecks } = await import('@/lib/buy/service');
    const { checkPriceWatches, createPriceWatch } = await import('@/lib/watches/service');
    const { buyChecks } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    setTestUser(owner);
    const saved = await (await buyPOST(jsonReq('/x', 'POST', {
      vin: FIXTURE_VINS.mustang2019, askingPrice: 28900, mileage: 46100, sellerType: 'dealer', zip: '60601',
    }), ctx())).json();
    const id = saved.buyCheck.id as string;
    const realMid = saved.buyCheck.verdict.mid as number;
    // Pretend the stored snapshot was far above today's market; watch for it dropping below.
    await db.update(buyChecks).set({ verdict: { ...saved.buyCheck.verdict, mid: realMid + 10000 } }).where(eq(buyChecks.id, id));
    await createPriceWatch(db, owner, { buyCheckId: id, threshold: realMid + 5000, direction: 'below' });
    expect(await checkPriceWatches(db, '2026-11-12')).toEqual([]);
    const { getProviders } = await import('@/lib/providers');
    expect(await revalueWatchedBuyChecks(db, getProviders(), '2026-11-13')).toEqual({ updated: 1, failed: 0 });
    const d = await checkPriceWatches(db, '2026-11-13');
    expect(d).toHaveLength(1);
    expect(d[0]!.type).toBe('price_target');
    expect(await checkPriceWatches(db, '2026-11-14')).toEqual([]);
  });
});
