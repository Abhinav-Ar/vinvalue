import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { appraisals, vehicles } from './db/schema';
import type { HistoryCollection, HistoryItem } from '@/shared/collection';

/** Read-only, latest-per-case-insensitive-VIN collection. The full timeline is untouched. */
export async function historyRows(db: Db, userId: string): Promise<HistoryItem[]> {
  const vinKey = sql<string>`upper(trim(${appraisals.inputs}->>'vin'))`;
  const [latest, garage] = await Promise.all([
    db.selectDistinctOn([vinKey]).from(appraisals).where(eq(appraisals.userId, userId))
      .orderBy(vinKey, desc(appraisals.createdAt), desc(appraisals.id)),
    db.select().from(vehicles).where(eq(vehicles.userId, userId)),
  ]);
  const key = (vin: string) => vin.trim().toUpperCase();
  const owned = new Map(garage.map(v => [key(v.vin), v]));
  const seen = new Set<string>();
  const items: HistoryItem[] = latest.map(a => {
    const vin = key(a.inputs.vin); seen.add(vin);
    return { id: a.id, vin, vehicleId: owned.get(vin)?.id ?? null, source: 'appraisal',
      label: [a.specs.year, a.specs.make, a.specs.model, a.inputs.trim].filter(Boolean).join(' '),
      createdAt: a.createdAt.toISOString(), reportUrl: `/report/${encodeURIComponent(a.shareSlug)}`,
      values: { private: a.privateValue.value, instant: a.instantValue.value, retail: a.retailValue.value } };
  });
  for (const v of garage) if (!seen.has(key(v.vin))) {
    items.push({ id: v.id, vin: key(v.vin), vehicleId: v.id, source: 'garage',
      label: [v.specs.year, v.specs.make, v.specs.model, v.trim].filter(Boolean).join(' '),
      createdAt: v.createdAt.toISOString(), reportUrl: null, values: null });
    seen.add(key(v.vin));
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
export async function listHistory(db: Db, userId: string, options: { offset?: number; limit?: number; garageOnly?: boolean } = {}): Promise<HistoryCollection> {
  const rows = (await historyRows(db, userId)).filter(i => !options.garageOnly || i.vehicleId !== null);
  const offset = Math.max(0, options.offset ?? 0), limit = Math.min(50, Math.max(1, options.limit ?? 50));
  return { items: rows.slice(offset, offset + limit), total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null };
}
