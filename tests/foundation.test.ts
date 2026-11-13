import { describe, it, expect } from 'vitest';
import { createTestDb, createUser } from './helpers/db';
import { fixtureProviders, FIXTURE_VINS } from './helpers/providers';
import { splitTrims, titleCaseMake } from '@/lib/providers/nhtsa';
import { buildParams, mapListing } from '@/lib/providers/marketcheck';
import { redact, scrubString } from '@/lib/log';
import { median, quantile, weightedMedian } from '@/lib/stats';
import { vinSchema, zipSchema, mileageSchema } from '@/lib/validation';

describe('foundation', () => {
  it('migrates a PGlite db and inserts a user', async () => {
    const db = await createTestDb();
    const u = await createUser(db);
    expect(u.id).toBeTruthy();
    expect(u.nextReportSeq).toBe(0);
  });

  it('splits vPIC trims and normalizes make', () => {
    expect(splitTrims('L/LE/SE/XLE')).toEqual(['L', 'LE', 'SE', 'XLE']);
    expect(splitTrims('GT Coupe')).toEqual(['GT']);
    expect(splitTrims('')).toEqual([]);
    expect(titleCaseMake('TOYOTA')).toBe('Toyota');
    expect(titleCaseMake('BMW')).toBe('BMW');
  });

  it('decodes recorded vPIC fixtures', async () => {
    const p = fixtureProviders();
    const camry = await p.vin.decode(FIXTURE_VINS.camry2018);
    expect(camry).toMatchObject({ year: 2018, make: 'Toyota', model: 'Camry', trimCandidates: ['L', 'LE', 'SE', 'XLE'], checkDigitValid: false });
    await expect(p.vin.decode(FIXTURE_VINS.invalid)).rejects.toMatchObject({ status: 422, code: 'vin_not_decoded' });
  });

  it('builds MarketCheck params lowercased, paged, no slash trims', () => {
    const p = buildParams({ make: 'TOYOTA', model: 'Camry', yearFrom: 2017, yearTo: 2019, trim: 'L/LE/SE/XLE', zip: '60601', radiusMiles: 100, maxResults: 100 }, 0, 50, 'k');
    expect(p.get('make')).toBe('toyota');
    expect(p.get('year')).toBe('2017,2018,2019');
    expect(p.get('trim')).toBeNull();
    expect(p.get('rows')).toBe('50');
    expect(mapListing({ price: null, miles: 1, build: { year: 2019 } })).toBeNull();
  });

  it('redacts sensitive data from logs', () => {
    expect(scrubString('https://x/y?api_key=SECRET&zip=1')).toContain('api_key=[redacted]');
    expect(scrubString('vin 1FA6P8CF0K5123456 here')).toBe('vin [vin] here');
    expect(redact({ vin: 'x', zip: '60601', email: 'a@b.co', ok: 1 })).toEqual({ vin: '[redacted]', zip: '[redacted]', email: '[redacted]', ok: 1 });
  });

  it('stats', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(weightedMedian([{ value: 1, weight: 1 }, { value: 2, weight: 1 }])).toBe(1.5);
    expect(weightedMedian([{ value: 1, weight: 1 }, { value: 10, weight: 5 }])).toBe(10);
  });

  it('validates inputs without defaults', () => {
    expect(vinSchema.parse('1fa6p8cf0k5123456')).toBe('1FA6P8CF0K5123456');
    expect(vinSchema.safeParse('1FA6P8CF0K512345O').success).toBe(false);
    expect(zipSchema.safeParse(undefined).success).toBe(false);
    expect(mileageSchema.parse('38,200')).toBe(38200);
    expect(mileageSchema.safeParse(6_500_045_000).success).toBe(false);
    expect(mileageSchema.safeParse(undefined).success).toBe(false);
  });
});
