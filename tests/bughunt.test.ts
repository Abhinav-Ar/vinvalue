/**
 * Regressions for bugs found while exercising the running app (2026-11-13).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from './helpers/db';
import { useFixtureProviders, fixtureProviders, FIXTURE_VINS } from './helpers/providers';
import { setProviders } from '@/lib/providers';

import type { Db } from '@/lib/db';
import { POST as appraisePOST } from '@/app/api/appraisals/route';
import { POST as decodePOST } from '@/app/api/vin/decode/route';
import { aggregateListings } from '@/lib/market/aggregate';
import type { Listing } from '@/lib/providers/types';

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://test${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({}) };

let _db: Db;
beforeEach(async () => {
  _db = await createTestDb();
  useFixtureProviders();
});
afterEach(() => {
  setProviders(null);
  process.env.RATE_LIMIT_DISABLED = '1';
});

describe('unknown trim', () => {
  it('returns 400 on fields.trim with the trims seen in listings, not too_few_comps 0', async () => {
    const res = await appraisePOST(post('/api/appraisals', {
      vin: FIXTURE_VINS.mustang2019, trim: 'Shelby GT500', mileage: 38200, zip: '60601', condition: 'good', title: 'clean', accidents: 'none',
    }), ctx as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_input');
    expect(body.error.fields.trim).toBeTruthy();
    expect(body.error.trimCandidates).toContain('GT');
  });
});

describe('missing fields', () => {
  it('say "Required." instead of zod internals', async () => {
    const res = await appraisePOST(post('/api/appraisals', { vin: FIXTURE_VINS.mustang2019 }), ctx as never);
    expect(res.status).toBe(400);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('received undefined');
  });
});

describe('rate limiting', () => {
  it('answers 429 rate_limited with Retry-After once the decode limit is used up', async () => {
    delete process.env.RATE_LIMIT_DISABLED;
    const h = { 'x-forwarded-for': '203.0.113.7' };
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) last = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.mustang2019 }, h), ctx as never);
    expect(last!.status).toBe(429);
    expect((await last!.json()).error.code).toBe('rate_limited');
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
    // A different client is unaffected.
    const other = await decodePOST(post('/api/vin/decode', { vin: FIXTURE_VINS.mustang2019 }, { 'x-forwarded-for': '203.0.113.8' }), ctx as never);
    expect(other.status).toBe(200);
  });
});

describe('market aggregates', () => {
  it('count a car listed on two sites once and leave out certified listings', () => {
    const l = (id: string, vin: string, price: number, inventoryType = 'used'): Listing =>
      ({ id, vin, price, miles: 30000, year: 2019, trim: 'GT', sellerType: 'dealer', distance: 10, daysOnMarket: 20, inventoryType } as Listing);
    const a = aggregateListings([l('1', 'A', 20000), l('2', 'A', 20000), l('3', 'B', 30000), l('4', 'C', 40000, 'certified')], 4);
    expect(a.count).toBe(2);
    expect(a.medianPrice).toBe(25000);
  });
});

describe('fixture decoder (dev)', () => {
  it('decodes a sibling VIN of a recorded one with its own model year', async () => {
    const d = await fixtureProviders().vin.decode('1FA6P8CF2J5000001');
    expect(d.make).toBe('Ford');
    expect(d.year).toBe(2018);
  });
});


