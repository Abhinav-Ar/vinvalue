/** Server-side, validated reference snapshot. Missing files never imply invented anchors. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { msrpTableSchema, generationTableSchema, variantTableSchema, cpiTableSchema, type MsrpRow, type GenerationRef, type VariantRef, type CpiTable } from './schema';
export type ReferenceData = { msrp: MsrpRow[]; generations: GenerationRef[]; variants: VariantRef[]; cpi: CpiTable | null };
export function loadReferences(directory = join(process.cwd(), 'models/reference/data')): ReferenceData {
  const read = (name: string): unknown => {
    try { return JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e; }
  };
  const m = read('msrp'), g = read('generations'), v = read('variants'), c = read('cpi');
  return { msrp: m === undefined ? [] : msrpTableSchema.parse(m), generations: g === undefined ? [] : generationTableSchema.parse(g), variants: v === undefined ? [] : variantTableSchema.parse(v), cpi: c === undefined ? null : cpiTableSchema.parse(c) };
}
const names=new Map<string,string>();
export const exactName = (s:string) => {
  const cached=names.get(s);if(cached!==undefined)return cached;
  const value=s.trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
  if(names.size>=20000)names.clear();
  names.set(s,value);return value;
};
export type ReferenceIdentity = { year: number; make: string; model: string; transmission?: string | null };
// ReferenceData snapshots are immutable. Weak keys release indexes with their snapshot.
const indexes = new WeakMap<ReferenceData, Map<string, MsrpRow[]>>();
export function referenceCandidates(data: ReferenceData, make: string, model: string) {
  let index = indexes.get(data);
  if (!index) {
    index = new Map();
    for (const row of data.msrp) for (const alias of new Set([row.model, ...row.modelAliases].map(exactName))) {
      const key = exactName(row.make)+'/'+alias;
      const list = index.get(key) ?? []; list.push(row); index.set(key, list);
    }
    indexes.set(data, index);
  }
  return index.get(exactName(make)+'/'+exactName(model)) ?? [];
}
export function resolveReference(data: ReferenceData, specs: ReferenceIdentity, trim: string | null) {
  const family = (r: { make: string; model: string }) => exactName(r.make) === exactName(specs.make) && exactName(r.model) === exactName(specs.model);
  // MSRP rows may also match on vPIC model aliases; the canonical model then links generation/variant refs.
  const msrpFamily = (r: MsrpRow) => exactName(r.make) === exactName(specs.make) && [r.model, ...(r.modelAliases ?? [])].some(m => exactName(m) === exactName(specs.model));
  const candidates = referenceCandidates(data, specs.make, specs.model).filter(r => msrpFamily(r) && specs.year >= r.yearFrom && specs.year <= r.yearTo && trim != null && [r.trim, ...r.trimAliases].some(t => exactName(t) === exactName(trim)) && (r.transmission === 'any' || !specs.transmission || exactName(specs.transmission) === r.transmission));
  const msrpRow = candidates.length === 1 ? candidates[0]! : null;
  const canonical = msrpRow ? { make: msrpRow.make, model: msrpRow.model } : null;
  const sameFamily = (r: { make: string; model: string }) => canonical ? exactName(r.make) === exactName(canonical.make) && exactName(r.model) === exactName(canonical.model) : family(r);
  const generations = data.generations.filter(r => sameFamily(r) && specs.year >= r.yearFrom && specs.year <= r.yearTo && (!msrpRow || r.generation === msrpRow.generation));
  const generationRef = generations.length === 1 ? generations[0]! : null;
  const variants = data.variants.filter(r => sameFamily(r) && r.generation === msrpRow?.generation && exactName(r.trim) === exactName(msrpRow.trim));
  return { msrpRow, generationRef, variantRef: variants.length === 1 ? variants[0]! : null };
}
