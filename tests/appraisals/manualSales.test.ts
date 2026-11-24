import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Offline JavaScript CLI is deliberately also importable for tests.
import { header, parseCsv, validateManualSales } from '../../scripts/reference/check-manual-sales.mjs';
const ref = [{ make: 'FORD', model: 'F-150', generation: 'PN96', trim: 'XL', yearFrom: 1997, yearTo: 2003 }];
const row = 'Bring a Trailer,https://bringatrailer.com/listing/test/,2025-01-01,FORD,F-150,PN96,XL,2001,80000,12000,manual,Completed sale,false';
const check = (r = row) => validateManualSales(header + '\n' + r, ref, '2026-11-23');
describe('offline manual sales validation', () => {
  it('ignores all three clearly fake shipped examples', () => {
    const csv = readFileSync('scripts/reference/calibration/manual-sales.csv', 'utf8');
    expect(validateManualSales(csv, ref)).toEqual({ errors: [], count: 0 });
    expect(parseCsv(csv)).toHaveLength(4);
  });
  it('accepts a reference-matched completed sale with quoted multiline notes', () => {
    expect(check(row.replace('Completed sale', '"Completed, sold\nread by hand"'))).toEqual({ errors: [], count: 1 });
  });
  it.each([
    ['PN96', 'unknown'], ['2001,80000', '2004,80000'], ['80000', '-1'], ['12000', '499'],
    ['2025-01-01', '2025-02-30'], ['2025-01-01', '2099-01-01'], ['Completed sale', 'bid to $12000'],
    ['bringatrailer.com', 'evil.test'], ['false', 'maybe'],
  ])('reports row numbers for invalid %s', (from, to) => {
    expect(check(row.replace(from, to)).errors.join(' ')).toMatch(/Row 2:/);
  });
  it('detects duplicate canonical URLs and malformed CSV', () => {
    expect(check(row + '\n' + row.replace('test/', 'test/?tracking=1')).errors.join(' ')).toContain('Row 3: duplicate url');
    expect(() => parseCsv('"unterminated')).toThrow(/Unterminated/);
  });
});
