// Validate a calibration reference CSV (make,model,generation,trim,year,mileage,privatePartyUsd,confidence):
// every row must join an msrp.json row, values must be plausible, and the set must not be a formula of MSRP.
//
//   node scripts/reference/check-calibration-refs.mjs <refs.csv>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: check-calibration-refs.mjs <refs.csv>');
const msrp = JSON.parse(readFileSync(new URL('../../models/reference/data/msrp.json', import.meta.url), 'utf8'));
const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
const header = lines.shift().split(',').map((s) => s.trim());
const want = ['make', 'model', 'generation', 'trim', 'year', 'mileage', 'privatePartyUsd', 'confidence'];
if (want.join() !== header.join()) throw new Error(`header must be ${want.join(',')}`);
const errors = [], seen = new Set(), ratios = [];
const lower = (s) => s.trim().toLowerCase();
for (const [i, line] of lines.entries()) {
  const cells = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  const [make, model, generation, trim, yearS, milesS, valueS, confidence] = cells;
  const year = Number(yearS), miles = Number(milesS), value = Number(valueS), at = `row ${i + 2}`;
  if (cells.length !== 8) { errors.push(`${at}: expected 8 columns`); continue; }
  const row = msrp.find((r) => lower(r.make) === lower(make) && lower(r.model) === lower(model) && r.generation === generation && r.trim === trim && year >= r.yearFrom && year <= r.yearTo);
  if (!row) errors.push(`${at}: ${make} ${model} ${generation} ${trim} ${year} does not join msrp.json`);
  if (!(miles >= 0 && miles <= 400000)) errors.push(`${at}: mileage ${milesS}`);
  if (!(value >= 500 && value <= 5_000_000)) errors.push(`${at}: value ${valueS}`);
  if (!['high', 'medium', 'low'].includes(confidence)) errors.push(`${at}: confidence ${confidence}`);
  const key = [make, model, trim, year, miles].join('|').toLowerCase();
  if (seen.has(key)) errors.push(`${at}: duplicate ${key}`); seen.add(key);
  if (row) ratios.push(value / row.msrpUsd);
}
// Anti-template: values derived as a fixed fraction of MSRP collapse to few distinct ratios.
const distinct = new Set(ratios.map((r) => r.toFixed(3))).size;
if (ratios.length >= 20 && distinct < ratios.length * 0.6) errors.push(`value/MSRP ratios look formulaic (${distinct} distinct of ${ratios.length})`);
console.log(`${lines.length} rows, ${distinct} distinct value/MSRP ratios`);
if (errors.length) { console.error(errors.slice(0, 40).join('\n')); process.exit(1); }
console.log('OK');
