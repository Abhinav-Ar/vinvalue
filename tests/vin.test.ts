import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createTestDb } from './helpers/db';
import { fixtureProviders, FIXTURE_VINS } from './helpers/providers';
import { checkDigitValid, expectedCheckDigit, modelYearWarning, withValidCheckDigit } from '@/lib/vin';
import { decodeVin, assertCheckDigit, mileageFlags } from '@/lib/vin-decode';
import { splitTrims } from '@/lib/providers/nhtsa';
import { vinDecodes } from '@/lib/db/schema';

describe('VIN check digit', () => {
  it('matches known-valid VINs and the vPIC verdicts on recorded fixtures', () => {
    expect(checkDigitValid('11111111111111111')).toBe(true);
    expect(checkDigitValid('1M8GDM9AXKP042788')).toBe(true); // check digit X
    expect(checkDigitValid(FIXTURE_VINS.mustang2019)).toBe(true);
    expect(checkDigitValid(FIXTURE_VINS.camry2018)).toBe(true);
    expect(checkDigitValid(FIXTURE_VINS.supra2020)).toBe(true);
  });
  it('rejects the design sample VIN: position 9 should be 9', () => {
    expect(expectedCheckDigit(FIXTURE_VINS.badCheckDigit)).toBe('9');
    expect(withValidCheckDigit(FIXTURE_VINS.badCheckDigit)).toBe(FIXTURE_VINS.mustang2019);
    expect(() => assertCheckDigit(FIXTURE_VINS.badCheckDigit)).toThrowError(/check digit/);
    try { assertCheckDigit(FIXTURE_VINS.badCheckDigit); } catch (e: any) {
      expect(e.status).toBe(400);
      expect(e.fields.vin[0]).toMatch(/Check character 9 should be 9/);
    }
  });
  it('warns instead of blocking for imported vehicles', () => {
    expect(assertCheckDigit(FIXTURE_VINS.badCheckDigit, true)).toEqual(['check_digit_mismatch_imported']);
  });
  it('flags implausible model years', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    expect(modelYearWarning(2027, now)).toBeNull();
    expect(modelYearWarning(2029, now)).toBe('model_year_in_future');
    expect(modelYearWarning(1979, now)).toBe('model_year_before_17_char_vins');
  });
});

describe('decodeVin', () => {
  it('decodes clean, caches by VIN, and does not call vPIC twice', async () => {
    const db = await createTestDb();
    const p = fixtureProviders();
    let calls = 0;
    const counting = { ...p, vin: { decode: (v: string) => { calls++; return p.vin.decode(v); } } };
    const a = await decodeVin(db, counting, FIXTURE_VINS.camry2018);
    const b = await decodeVin(db, counting, FIXTURE_VINS.camry2018);
    expect(calls).toBe(1);
    expect(a).toMatchObject({ make: 'Toyota', model: 'Camry', decodeStatus: 'clean', trimCandidates: ['L', 'LE', 'SE', 'XLE'] });
    expect(b.trimCandidates).toEqual(a.trimCandidates);
    const rows = await db.select().from(vinDecodes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.raw.ErrorCode).toBe('0');
  });
  it('returns 422 when vPIC cannot name the model (imported path skips only the check digit)', async () => {
    const db = await createTestDb();
    await expect(decodeVin(db, fixtureProviders(), FIXTURE_VINS.partial, { importedVehicle: true })).rejects.toMatchObject({ status: 422, code: 'vin_not_decoded' });
  });
  it('treats non-check-digit vPIC error codes as a partial decode', async () => {
    const { mapVpic } = await import('@/lib/providers/nhtsa');
    const row = JSON.parse(readFileSync('tests/fixtures/nhtsa/vpic_toyota_camry_2018.json', 'utf8')).Results[0];
    expect(mapVpic(FIXTURE_VINS.camry2018, { ...row, ErrorCode: '8' }).decodeStatus).toBe('partial');
    expect(mapVpic(FIXTURE_VINS.camry2018, { ...row, ErrorCode: '1' }).decodeStatus).toBe('check_digit_mismatch');
  });
  it('strips body and model words from trims', () => {
    expect(splitTrims('Supra 3.0', 'Supra')).toEqual(['3.0']);
    expect(splitTrims('GT Coupe', 'Mustang')).toEqual(['GT']);
  });
  it('flags mileage far above typical use for the age', () => {
    const now = new Date('2026-11-13T00:00:00Z');
    expect(mileageFlags(38200, 2019, 25000, now)).toEqual([]);
    expect(mileageFlags(210000, 2021, 25000, now)).toEqual(['mileage_high_for_age']);
  });
});
