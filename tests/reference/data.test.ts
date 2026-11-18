import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cpiTableSchema, generationTableSchema, msrpTableSchema, variantTableSchema } from '../../models/reference/schema';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const msrp = msrpTableSchema.parse(read('models/reference/data/msrp.json'));
const generations = generationTableSchema.parse(read('models/reference/data/generations.json'));
const variants = variantTableSchema.parse(read('models/reference/data/variants.json'));
const cpi = cpiTableSchema.parse(read('models/reference/data/cpi.json'));
const key = (r: {make:string;model:string;generation:string;trim?:string}) => [r.make,r.model,r.generation,r.trim ?? ''].join('|');
const family = (r: {make:string;model:string}) => `${r.make}|${r.model}`;

describe('reference data contract', () => {
  it('has unique MSRP identities and valid year ranges', () => {
    expect(new Set(msrp.map(key)).size).toBe(msrp.length);
    for (const r of msrp) {
      expect(r.yearFrom).toBeLessThanOrEqual(r.msrpModelYear);
      expect(r.msrpModelYear).toBeLessThanOrEqual(r.yearTo);
      expect(r.confidence === 'approximate').toBe(r.sourceUrl === undefined);
    }
  });
  it('does not overlap years for the same family, generation, and trim', () => {
    const byTrim = new Map<string, typeof msrp>();
    for (const r of msrp) byTrim.set(key(r), [...(byTrim.get(key(r)) ?? []), r]);
    for (const rows of byTrim.values()) {
      rows.sort((a,b) => a.yearFrom-b.yearFrom);
      for (let i=1;i<rows.length;i++) expect(rows[i]!.yearFrom).toBeGreaterThan(rows[i-1]!.yearTo);
    }
  });
  it('has variants backed by exact MSRP trims', () => {
    const ids = new Set(msrp.map(key));
    for (const v of variants) expect(ids.has(key(v))).toBe(true);
  });
  it('keeps higher tiers at or above lower tiers unless explained', () => {
    const byGeneration = new Map<string, typeof msrp>();
    for (const r of msrp) byGeneration.set(`${r.make}|${r.model}|${r.generation}`, [...(byGeneration.get(`${r.make}|${r.model}|${r.generation}`) ?? []), r]);
    for (const rows of byGeneration.values()) {
      for (const row of rows) for (const lower of rows) {
        if (row.tier > lower.tier && row.msrpUsd < lower.msrpUsd) expect(row.notes ?? '').toMatch(/why|exception|same equipment/i);
      }
    }
  });
  it('keeps MSRP in broad segment sanity bands', () => {
    const bands: Record<string,[number,number]> = { economy:[3000,100000], midsize:[5000,150000], fullsize:[5000,200000], luxury:[10000,500000], sports:[5000,500000], supercar:[20000,5000000], suv:[3000,250000], truck:[3000,250000], van:[5000,150000], ev:[10000,250000], other:[3000,500000] };
    for (const g of generations) for (const r of msrp.filter(x => family(x)===family(g) && x.generation===g.generation)) {
      const [min,max] = bands[g.segment]!; expect(r.msrpUsd).toBeGreaterThanOrEqual(min); expect(r.msrpUsd).toBeLessThanOrEqual(max);
    }
  });
  it('has contiguous annual CPI rows', () => {
    expect(cpi.rows.length).toBeGreaterThanOrEqual(10);
    for (let i=1;i<cpi.rows.length;i++) expect(cpi.rows[i]!.year).toBe(cpi.rows[i-1]!.year+1);
  });
  // Integrity guards: a previous curation pass generated identical template trims and price ladders.
  const byGen = () => {
    const m = new Map<string, typeof msrp>();
    for (const r of msrp) { const k = `${r.make}|${r.model}|${r.generation}`; m.set(k, [...(m.get(k) ?? []), r]); }
    return m;
  };
  it('uses real trim names, not the model name or a generic template', () => {
    const generic = new Set(['base', 'sport', 'touring', 'premium', 'performance', 'luxury', 'standard']);
    for (const r of msrp) expect(r.trim.toLowerCase().startsWith(r.model.toLowerCase() + ' ')).toBe(false);
    for (const [gen, rows] of byGen()) {
      const allGeneric = rows.length >= 3 && rows.every(r => generic.has(r.trim.toLowerCase()));
      expect(allGeneric, `${gen} has only generic template trims`).toBe(false);
    }
  });
  it('does not reuse one price ladder across different models', () => {
    const ladders = new Map<string, Set<string>>();
    for (const [gen, rows] of byGen()) {
      if (rows.length < 3) continue;
      const ladder = rows.map(r => r.msrpUsd).sort((a, b) => a - b).join(',');
      const fam = gen.split('|').slice(0, 2).join('|');
      ladders.set(ladder, (ladders.get(ladder) ?? new Set()).add(fam));
    }
    for (const [ladder, fams] of ladders) expect(fams.size, `price ladder ${ladder} reused by ${[...fams].join(', ')}`).toBeLessThan(2);
  });
  it('keeps generations of one model in order without overlapping years', () => {
    const spans = new Map<string, Map<string, [number, number]>>();
    for (const r of msrp) {
      const fam = family(r), gens = spans.get(fam) ?? new Map<string, [number, number]>();
      const s = gens.get(r.generation) ?? [r.yearFrom, r.yearTo];
      gens.set(r.generation, [Math.min(s[0], r.yearFrom), Math.max(s[1], r.yearTo)]); spans.set(fam, gens);
    }
    const maxYear = new Date().getUTCFullYear() + 1;
    for (const [fam, gens] of spans) {
      const sorted = [...gens.entries()].sort((a, b) => a[1][0] - b[1][0]);
      for (const [, [from, to]] of sorted) { expect(to).toBeLessThanOrEqual(maxYear); expect(to - from, `${fam} span`).toBeLessThanOrEqual(30); }
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]![1][0], `${fam} ${sorted[i - 1]![0]} overlaps ${sorted[i]![0]}`).toBeGreaterThan(sorted[i - 1]![1][1]);
    }
  });
  it('does not attach undocumented source URLs', () => {
    for (const r of msrp) if (r.sourceUrl) expect(r.confidence).toMatch(/documented|inferred/);
    for (const r of generations) if (r.sourceUrls.length) expect(r.G).toBe(1);
    for (const r of variants) expect(r.sourceUrls).toEqual([]);
  });
});
