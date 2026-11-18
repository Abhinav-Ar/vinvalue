// End-to-end sanity check: value real cars in model mode (no comparables) and compare with expected 2026 ranges.
import { computeValuation } from '@/models/valuation';
import calibration from './results.json';

const cars: [number, string, string, string, number, string][] = [
  [2017, 'TOYOTA', 'Camry', 'LE', 90000, '$13-15k'], [2019, 'FORD', 'Mustang', 'GT', 50000, '$29-33k'], [2015, 'NISSAN', 'Altima', '2.5 S', 120000, '$7-8.5k'],
  [2018, 'FORD', 'F-150', 'XLT', 80000, '$25-30k'], [2020, 'HONDA', 'CR-V', 'EX', 60000, '$22-25k'], [2016, 'JEEP', 'Wrangler', 'Sahara', 90000, '$20-25k'],
  [2001, 'HONDA', 'S2000', 'Base', 60000, '$25-32k'], [2019, 'TOYOTA', 'Tacoma', 'TRD Off-Road', 60000, '$31-35k'], [2010, 'TOYOTA', 'Corolla', 'LE', 150000, '$5.5-7k'],
  [2008, 'PORSCHE', '911', 'GT3', 30000, '$140-170k'], [2013, 'HONDA', 'Civic', 'LX', 110000, '$8.5-10.5k'], [2021, 'TOYOTA', 'RAV4', 'XLE', 40000, '$25-28k'],
];

for (const [year, make, model, trim, mileage, expect] of cars) {
  const specs = { year, make, model, trimRaw: trim, trimCandidates: [trim], body: null, drive: null, engine: null, fuel: null, doors: null, plant: null, checkDigitValid: true, transmission: null } as never;
  try {
    const r = computeValuation({ specs, inputs: { vin: 'X', mileage, zip: '60601', condition: 'good', title: 'clean', accidents: 'none', trim } as never, listings: [], trimConfirmedByUser: true, now: new Date('2026-11-16') });
    const a = (r as unknown as { audit: { score: number; references: { msrp?: { msrpUsd: number } } } }).audit;
    const split=(calibration.split as Record<string,string>)[`${make}/${model}`.toLowerCase()] ?? 'unseen';
    console.log(`[${split}] ${year} ${make} ${model} ${trim} ${mileage / 1000}k: $${r.private.value.toLocaleString()} ($${r.private.low.toLocaleString()}-${r.private.high.toLocaleString()})  expect ${expect}  D=${a.score.toFixed(2)} msrp=${a.references.msrp?.msrpUsd}`);
  } catch (e) {
    console.log(`${year} ${make} ${model} ${trim}: ${(e as Error).message}`);
  }
}
