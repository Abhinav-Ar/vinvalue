/**
 * Generates SYNTHETIC MarketCheck fixtures in the documented response shape
 * (num_found, listings[].{id,price,miles,dist,dom,dom_active,seller_type,inventory_type,build{year,make,model,trim}}).
 * Real recordings replace these via `npm run fixtures:record` once MARKETCHECK_API_KEY is set.
 * Deterministic (seeded) so tests are stable. Run: npx tsx scripts/make-marketcheck-fixtures.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

type Spec = {
  file: string; make: string; model: string; years: number[]; trims: string[];
  basePrice: number; baseMiles: number; perMile: number; perYear: number; n: number; outliers: number[];
};

function gen(s: Spec) {
  const listings = [];
  for (let i = 0; i < s.n; i++) {
    const year = s.years[Math.floor(rnd() * s.years.length)]!;
    const trim = s.trims[Math.floor(rnd() * s.trims.length)]!;
    const miles = Math.max(3000, Math.round(s.baseMiles + (rnd() - 0.5) * s.baseMiles * 0.9 - (year - s.years[1]!) * 9000));
    const price = Math.round((s.basePrice + (year - s.years[1]!) * s.perYear - (miles - s.baseMiles) * s.perMile + (rnd() - 0.5) * 2400) / 50) * 50;
    const dom = Math.round(5 + rnd() * 70);
    listings.push({
      id: `${s.file}-${String(i).padStart(3, '0')}`,
      price, miles, dist: Math.round(rnd() * 98 * 10) / 10, dom, dom_active: dom,
      seller_type: rnd() < 0.85 ? 'dealer' : 'fsbo', inventory_type: 'used',
      build: { year, make: s.make, model: s.model, trim },
    });
  }
  s.outliers.forEach((p, i) => listings.push({
    id: `${s.file}-out-${i}`, price: p, miles: s.baseMiles, dist: 40, dom: 10, dom_active: 10,
    seller_type: 'dealer', inventory_type: 'used', build: { year: s.years[1]!, make: s.make, model: s.model, trim: s.trims[0]! },
  }));
  // A malformed row the mapper must drop:
  listings.push({ id: `${s.file}-bad`, price: null, miles: 1000, dist: 1, dom: 1, dom_active: 1, seller_type: 'dealer', inventory_type: 'used', build: { year: s.years[1]!, make: s.make, model: s.model, trim: s.trims[0]! } } as never);
  return { _synthetic: true, num_found: listings.length, listings };
}

const specs: Spec[] = [
  { file: 'ford_mustang_gt_2018-2020_60601', make: 'Ford', model: 'Mustang', years: [2018, 2019, 2020], trims: ['GT', 'GT', 'GT', 'GT Premium'], basePrice: 27900, baseMiles: 44600, perMile: 0.09, perYear: 1300, n: 30, outliers: [9800, 61000, 58500] },
  { file: 'mazda_mx-5_miata_rf_2016-2018_60614', make: 'Mazda', model: 'MX-5 Miata RF', years: [2016, 2017, 2018], trims: ['Grand Touring', 'Club'], basePrice: 19600, baseMiles: 52000, perMile: 0.07, perYear: 1100, n: 22, outliers: [] },
  { file: 'toyota_gr_supra_2019-2021_60601', make: 'Toyota', model: 'GR Supra', years: [2019, 2020, 2021], trims: ['3.0', '3.0 Premium'], basePrice: 42300, baseMiles: 24000, perMile: 0.12, perYear: 1800, n: 26, outliers: [] },
  { file: 'toyota_camry_2017-2019_60601', make: 'Toyota', model: 'Camry', years: [2017, 2018, 2019], trims: ['LE', 'SE', 'XLE', 'L'], basePrice: 19800, baseMiles: 62000, perMile: 0.06, perYear: 1200, n: 40, outliers: [] },
  { file: 'toyota_rav4_2020-2022_94538', make: 'Toyota', model: 'RAV4', years: [2020, 2021, 2022], trims: ['XLE', 'LE', 'XLE Premium', 'Limited'], basePrice: 27400, baseMiles: 38000, perMile: 0.07, perYear: 1500, n: 40, outliers: [] },
  { file: 'sparse_3', make: 'Lotus', model: 'Emira', years: [2022, 2023, 2024], trims: ['V6'], basePrice: 98000, baseMiles: 4000, perMile: 0.5, perYear: 2000, n: 3, outliers: [] },
];

mkdirSync('tests/fixtures/marketcheck', { recursive: true });
for (const s of specs) {
  writeFileSync(`tests/fixtures/marketcheck/${s.file}.json`, JSON.stringify(gen(s), null, 1));
}
writeFileSync('tests/fixtures/marketcheck/error_401.json', JSON.stringify({ _synthetic: true, code: 401, message: 'Invalid API key' }));
writeFileSync('tests/fixtures/marketcheck/error_429.json', JSON.stringify({ _synthetic: true, code: 429, message: 'Rate limit exceeded' }));
console.log('wrote', specs.length + 2, 'fixtures');
