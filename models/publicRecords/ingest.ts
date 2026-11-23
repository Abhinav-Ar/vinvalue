import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { publicRecordJobState, publicRecordPopularity, publicRecordSales } from '@/models/db/schema';

export const WA_SALES_DATASET = 'rpr4-cgyd';
export const WA_POPULARITY_DATASET = 'brw6-jymh';
export const NY_POPULARITY_DATASET = 'w4pv-hbkt';
const SALES_URL = `https://data.wa.gov/resource/${WA_SALES_DATASET}.json`;
const SALE_TYPES = new Set(['Transfer Title', 'Original Title']);
const ACTUAL_ODO = 'Actual Mileage';

export type RawWaSale = Record<string, unknown>;
export type FilterResult = { row: typeof publicRecordSales.$inferInsert | null; reason?: string };

const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';
function dateOnly(v: unknown): string | null { const d = new Date(str(v)); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
function num(v: unknown): number | null { const n = Number(v); return Number.isFinite(n) ? n : null; }

/** Strict, privacy-safe normalizer. It intentionally never copies VIN, DOL id, city, ZIP, or geocodes. */
export function filterWashingtonSale(raw: RawWaSale, now = new Date()): FilterResult {
  const make = normalizeName(raw.make), model = normalizeName(raw.model);
  const year = num(raw.model_year), price = num(raw.sale_price), sale = dateOnly(raw.date_of_vehicle_sale) ?? dateOnly(raw.transaction_date);
  const tx = str(raw.transaction_type);
  if (!make || !model || !year || year < 1980 || year > now.getUTCFullYear() + 1) return { row: null, reason: 'identity' };
  if (str(raw.new_or_used_vehicle).toLowerCase() !== 'used') return { row: null, reason: 'new_vehicle' };
  if (!SALE_TYPES.has(tx)) return { row: null, reason: 'transaction_type' };
  if (!sale || price == null || price <= 1500) return { row: null, reason: 'nominal_price' };
  const age = Math.max(0, now.getUTCFullYear() - year);
  const max = age <= 3 ? 180000 : age <= 10 ? 120000 : 70000;
  if (price > max) return { row: null, reason: 'implausible_price' };
  const odoCode = str(raw.odometer_code), odoValue = num(raw.odometer_reading);
  const odometer = odoCode === ACTUAL_ODO && odoValue != null && odoValue >= 0 && odoValue <= 500000 ? Math.round(odoValue) : null;
  const transactionDate = dateOnly(raw.transaction_date) ?? sale;
  const county = str(raw.county).toUpperCase() || null;
  const stable = JSON.stringify({ make, model, year, price: Math.round(price), sale, transactionDate, tx, county, odometer });
  return { row: { sourceDataset: WA_SALES_DATASET, rowHash: createHash('sha256').update(stable).digest('hex'), make, model, modelYear: year, salePrice: Math.round(price), odometer, transactionMonth: `${sale.slice(0, 7)}-01`, transactionDate, transactionType: tx, county, state: 'WA', retrievedAt: now } };
}

export type IngestOptions = { pageSize?: number; maxPages?: number; fetchImpl?: typeof fetch; now?: Date; timeBudgetMs?: number; requestTimeoutMs?: number; retryDelayMs?: number };
export async function ingestWashingtonSales(db: Db, opts: IngestOptions = {}) {
  const pageSize = Math.min(opts.pageSize ?? 250, 1000), maxPages = opts.maxPages ?? 4, fetchImpl = opts.fetchImpl ?? fetch, now = opts.now ?? new Date(), deadline = Date.now() + (opts.timeBudgetMs ?? 25_000);
  const [state] = await db.select().from(publicRecordJobState).where(eq(publicRecordJobState.job, 'wa-sales')).limit(1);
  let offset = state?.offset ?? 0; let kept = 0, rejected = 0, pages = 0; const rejectedByReason: Record<string, number> = {}; let maxDate = state?.watermark ?? null;
  for (; pages < maxPages && Date.now() < deadline; pages++) {
    const u = new URL(SALES_URL); u.searchParams.set('$limit', String(pageSize)); u.searchParams.set('$offset', String(offset));
    const where = ["new_or_used_vehicle='Used'", 'sale_price > 1500', "transaction_type in('Transfer Title','Original Title')"];
    if (state?.watermark) where.push(`transaction_date ${offset > 0 ? '>=' : '>'} '${state.watermark.toISOString().slice(0, 10)}T00:00:00'`);
    u.searchParams.set('$where', where.join(' AND ')); u.searchParams.set('$order', 'transaction_date ASC, :id ASC');
    // The WA portal occasionally stalls on a single page; retry with backoff instead of failing the whole run.
    let res: Response | null = null;
    for (let attempt = 1; ; attempt++) {
      try {
        res = await fetchImpl(u, { signal: AbortSignal.timeout(opts.requestTimeoutMs ?? 20_000) });
        if (res.ok || res.status < 500 || attempt >= 3) break;
      } catch (err) { if (attempt >= 3) throw err; }
      await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 2000 * attempt));
    }
    if (!res!.ok) throw new Error(`WA SODA ${res!.status}`);
    const rows = await res!.json() as RawWaSale[]; if (!Array.isArray(rows) || rows.length === 0) { offset = 0; break; }
    for (const raw of rows) { const f = filterWashingtonSale(raw, now); if (!f.row) { rejected++; const reason = f.reason ?? 'rejected'; rejectedByReason[reason] = (rejectedByReason[reason] ?? 0) + 1; continue; } try { await db.insert(publicRecordSales).values(f.row).onConflictDoNothing({ target: publicRecordSales.rowHash }); kept++; } catch { rejectedByReason.duplicate = (rejectedByReason.duplicate ?? 0) + 1; } const d = new Date(f.row.transactionDate); if (!maxDate || d > maxDate) maxDate = d; }
    offset += rows.length; if (rows.length < pageSize) { offset = 0; break; }
  }
  const watermark = offset === 0 ? maxDate : state?.watermark ?? null;
  await db.insert(publicRecordJobState).values({ job: 'wa-sales', offset, watermark, updatedAt: now }).onConflictDoUpdate({ target: publicRecordJobState.job, set: { offset, watermark, updatedAt: now } });
  return { pages, kept, rejected, rejectedByReason, offset, watermark: watermark?.toISOString() ?? null };
}

export function normalizeName(value: unknown): string {
  return str(value).toUpperCase().replace(/\s+/g, ' ').trim().replace(/\bMODEL\s*([0-9XY])\b/g, 'MODEL $1');
}

export type PopularityRow = { sourceDataset: string; state: string; make: string; model: string; modelYear: number; period: string; vehicleCount: number };
export async function refreshPopularity(db: Db, rows: PopularityRow[], now = new Date()) {
  for (const r of rows) await db.insert(publicRecordPopularity).values({ ...r, make: normalizeName(r.make), model: normalizeName(r.model), refreshedAt: now }).onConflictDoUpdate({ target: [publicRecordPopularity.sourceDataset, publicRecordPopularity.state, publicRecordPopularity.make, publicRecordPopularity.model, publicRecordPopularity.modelYear, publicRecordPopularity.period], set: { vehicleCount: r.vehicleCount, refreshedAt: now } });
  return rows.length;
}
