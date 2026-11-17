import { describe, it, expect } from 'vitest';
import {
  addMonths, annualDepreciation, bandPct, forecastValue, observedMilesPerYear, seasonalityFromSeries,
} from '@/models/forecast';
import { forecastConfig } from '@/models/config/forecast';

const FLAT = new Array(12).fill(1);
const base = { today: '2026-11-12', currentValue: 27450, modelYear: 2019, milesPerYear: 12000 };

describe('forecast math', () => {
  it('months start the month after today and wrap years', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    const f = forecastValue({ ...base, seasonality: FLAT });
    expect(f.points.map((p) => p.month)).toEqual([
      '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05',
      '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11',
    ]);
  });

  it('depreciation bands by age', () => {
    expect(annualDepreciation(0.5)).toBe(0.15);
    expect(annualDepreciation(2)).toBe(0.12);
    expect(annualDepreciation(5)).toBe(0.1);
    expect(annualDepreciation(8)).toBe(0.08);
    expect(annualDepreciation(15)).toBe(0.06);
  });

  it('flat seasonality, baseline miles: 12-month mid = V0 x (1 - 8%)', () => {
    const f = forecastValue({ ...base, seasonality: FLAT });
    expect(f.in12).toBe(Math.round((27450 * 0.92) / 10) * 10); // 25250
    expect(f.expectedDrop).toBe(27450 - f.in12);
    for (let i = 1; i < 12; i++) expect(f.points[i]!.mid).toBeLessThanOrEqual(f.points[i - 1]!.mid);
  });

  it('mileage scenario: 10k extra miles a year costs about V0 x 0.4% x 10 by month 12', () => {
    const lo = forecastValue({ ...base, seasonality: FLAT });
    const hi = forecastValue({ ...base, seasonality: FLAT, milesPerYear: 22000 });
    const diff = lo.in12 - hi.in12;
    expect(diff).toBeGreaterThanOrEqual(1080);
    expect(diff).toBeLessThanOrEqual(1110);
    const low = forecastValue({ ...base, seasonality: FLAT, milesPerYear: 0 });
    expect(low.in12).toBeGreaterThan(lo.in12);
  });

  it('band grows with sqrt(t) and is capped', () => {
    expect(bandPct(1)).toBeCloseTo(0.015);
    expect(bandPct(4)).toBeCloseTo(0.03);
    expect(bandPct(1000)).toBe(forecastConfig.bandMaxPct);
    const f = forecastValue({ ...base, seasonality: FLAT });
    const w = f.points.map((p) => p.high - p.low);
    expect(w[11]).toBeGreaterThan(w[0]!);
    for (const p of f.points) expect(p.low).toBeLessThanOrEqual(p.mid);
  });

  it('default seasonality: best month within 6 months is the spring peak', () => {
    const f = forecastValue(base); // default table: Nov 0.98, Mar 1.02
    expect(f.bestMonthToSell.month).toBe('2027-03');
    expect(f.bestMonthToSell.value).toBe(f.points[3]!.mid);
    expect(f.points.slice(0, 6).every((p) => p.mid <= f.bestMonthToSell.value)).toBe(true);
  });

  it('best month with flat seasonality is the first month (earliest wins)', () => {
    expect(forecastValue({ ...base, seasonality: FLAT }).bestMonthToSell.month).toBe('2026-12');
  });

  it('is deterministic', () => {
    expect(forecastValue(base)).toEqual(forecastValue(base));
  });

  it('seasonality falls back (null) with fewer than 12 months or uncovered months', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ month: addMonths('2025-01', i), median: 28000 }));
    expect(seasonalityFromSeries(eleven)).toBeNull();
    const gappy = Array.from({ length: 12 }, (_, i) => ({ month: addMonths('2024-01', i * 2), median: 28000 }));
    expect(seasonalityFromSeries(gappy)).toBeNull();
  });

  it('seasonality from 24 months recovers the pattern despite a downward trend', () => {
    const idx = [0.98, 1, 1.03, 1.03, 1.01, 1, 1, 0.99, 0.99, 0.98, 0.97, 0.98];
    const series = Array.from({ length: 24 }, (_, i) => ({
      month: addMonths('2024-12', i),
      median: 30000 * Math.pow(0.99, i) * idx[(11 + i) % 12]!,
    }));
    const s = seasonalityFromSeries(series)!;
    expect(s).toHaveLength(12);
    const mean = idx.reduce((a, b) => a + b, 0) / 12;
    s.forEach((v, i) => expect(Math.abs(v - idx[i]! / mean)).toBeLessThan(0.004));
  });

  it('observed miles per year from odometer readings', () => {
    expect(observedMilesPerYear([{ miles: 30000, recordedOn: '2026-01-01' }])).toBeNull();
    expect(observedMilesPerYear([{ miles: 30000, recordedOn: '2026-01-01' }, { miles: 30100, recordedOn: '2026-01-10' }])).toBeNull();
    expect(observedMilesPerYear([
      { miles: 40000, recordedOn: '2026-07-02' },
      { miles: 35000, recordedOn: '2026-01-01' },
    ])).toBe(10000);
  });
});
