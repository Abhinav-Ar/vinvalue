import { afterEach, expect, it } from 'vitest';
import { createTestDb } from '../helpers/db';
import { fixtureProviders, FIXTURE_VINS } from '../helpers/providers';
import { setProviders } from '@/models/providers';
import { allowedTrims, loadReferences, resolveReference } from '@/models/reference';
import { POST as decodePOST } from '@/app/api/vin/decode/route';
import { POST as appraisePOST } from '@/app/api/appraisals/route';

const post = (body: unknown) => new Request('http://test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const trims = ['Standard Range Plus', 'Long Range', 'Performance'];
afterEach(() => setProviders(null));

it('offers tier-ordered reference trims for empty vPIC results, including cached decodes, and values the selection', async () => {
  await createTestDb();
  const p = fixtureProviders();
  const decoded = await p.vin.decode(FIXTURE_VINS.mustang2019);
  setProviders({ ...p, vin: { decode: async () => ({ ...decoded, year: 2019, make: 'tesla', model: 'MODEL 3', trimRaw: null, trimCandidates: [] }) }, listings: { searchActive: async () => ({ numFound: 0, listings: [] }) } });
  for (let i = 0; i < 2; i++) {
    const res = await decodePOST(post({ vin: decoded.vin }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ trimCandidates: trims, trimSource: 'reference', needsTrimChoice: true, specs: { trimCandidates: [] } });
  }
  const inputs = { vin: decoded.vin, mileage: 60000, zip: '60601', condition: 'good', title: 'clean', accidents: 'none' };
  const missing = await appraisePOST(post(inputs));
  expect(missing.status).toBe(400);
  expect((await missing.json()).error.trimCandidates).toEqual(trims);
  const invalid = await appraisePOST(post({ ...inputs, trim: 'Made up' }));
  expect(invalid.status).toBe(400);
  const valid = await appraisePOST(post({ ...inputs, trim: trims[1] }));
  expect(valid.status).toBe(201);
  expect(await valid.json()).toMatchObject({ base: { label: 'Model estimate (no local sales data)' }, private: { value: expect.any(Number) } });
});

it('uses model aliases and case-insensitive identity, with the same matches as anchor resolution', () => {
  const data = loadReferences();
  const row = data.msrp.find(r => r.modelAliases.length > 0)!;
  const specs = { year: row.msrpModelYear, make: row.make.toLowerCase(), model: row.modelAliases[0]!.toUpperCase(), trimCandidates: [] };
  expect(allowedTrims(specs, data)).toContain(row.trim);
  expect(resolveReference(data, specs, row.trim).msrpRow).not.toBeNull();
  expect(allowedTrims({ ...specs, year: 1900 }, data)).toEqual([]);
});

it('keeps vPIC candidates authoritative even when the reference offers other trims', async () => {
  await createTestDb();
  setProviders(fixtureProviders());
  const res = await decodePOST(post({ vin: FIXTURE_VINS.mustang2019 }));
  expect(await res.json()).toMatchObject({ trimCandidates: ['GT'], trimSource: 'vpic', needsTrimChoice: false });
  const invalid = await appraisePOST(post({ vin: FIXTURE_VINS.mustang2019, trim: 'Shelby GT500', mileage: 38200, zip: '60601', condition: 'good', title: 'clean', accidents: 'none' }));
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).error.trimCandidates).toEqual(['GT']);
});
