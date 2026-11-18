/**
 * Validate one MSRP batch file against the reference contract plus the integrity guards in
 * tests/reference/data.test.ts (real trim names, no reused price ladders, ordered generations).
 *
 *   npx tsx scripts/reference/check-msrp-batch.ts <batch.json>
 */
import { readFileSync } from 'node:fs';
import { msrpTableSchema } from '../../models/reference/schema';

const file = process.argv[2];
if (!file) throw new Error('usage: check-msrp-batch.ts <batch.json>');
const rows = msrpTableSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
const errors: string[] = [];
const generic = new Set(['base', 'sport', 'touring', 'premium', 'performance', 'luxury', 'standard']);
const byGen = new Map<string, typeof rows>();
for (const r of rows) {
  const k = `${r.make}|${r.model}|${r.generation}`;
  byGen.set(k, [...(byGen.get(k) ?? []), r]);
  if (r.trim.toLowerCase().startsWith(`${r.model.toLowerCase()} `)) errors.push(`${k}: trim "${r.trim}" repeats the model name`);
  if (r.confidence === 'approximate' && r.sourceUrl) errors.push(`${k} ${r.trim}: approximate rows must not have sourceUrl`);
}
const ids = new Set<string>();
for (const r of rows) { const id = `${r.make}|${r.model}|${r.generation}|${r.trim}`; if (ids.has(id)) errors.push(`duplicate ${id}`); ids.add(id); }
const ladders = new Map<string, Set<string>>();
const spans = new Map<string, Map<string, [number, number]>>();
for (const [gen, g] of byGen) {
  if (g.length >= 3 && g.every((r) => generic.has(r.trim.toLowerCase()))) errors.push(`${gen}: only generic template trims`);
  for (const a of g) for (const b of g) if (a.tier > b.tier && a.msrpUsd < b.msrpUsd && !/why|exception|same equipment/i.test(a.notes ?? '')) errors.push(`${gen}: ${a.trim} (tier ${a.tier}) cheaper than ${b.trim} (tier ${b.tier}) without a note`);
  const fam = gen.split('|').slice(0, 2).join('|');
  if (g.length >= 3) { const l = g.map((r) => r.msrpUsd).sort((x, y) => x - y).join(','); ladders.set(l, (ladders.get(l) ?? new Set()).add(fam)); }
  const s = spans.get(fam) ?? new Map<string, [number, number]>();
  s.set(gen.split('|')[2]!, [Math.min(...g.map((r) => r.yearFrom)), Math.max(...g.map((r) => r.yearTo))]); spans.set(fam, s);
}
for (const [l, fams] of ladders) if (fams.size > 1) errors.push(`price ladder ${l} reused by ${[...fams].join(', ')}`);
const maxYear = new Date().getUTCFullYear() + 1;
for (const [fam, gens] of spans) {
  const sorted = [...gens.entries()].sort((a, b) => a[1][0] - b[1][0]);
  for (const [g, [from, to]] of sorted) { if (to > maxYear) errors.push(`${fam} ${g}: yearTo ${to} in the future`); if (to - from > 30) errors.push(`${fam} ${g}: span ${from}-${to} too long`); }
  for (let i = 1; i < sorted.length; i++) if (sorted[i]![1][0] <= sorted[i - 1]![1][1]) errors.push(`${fam}: ${sorted[i - 1]![0]} (${sorted[i - 1]![1].join('-')}) overlaps ${sorted[i]![0]} (${sorted[i]![1].join('-')})`);
}
console.log(`${rows.length} rows, ${byGen.size} generations, ${spans.size} models`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('OK');
