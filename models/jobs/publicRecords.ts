import type { Db } from '@/models/db';
import { ingestWashingtonSales, refreshPopularity, WA_POPULARITY_DATASET, NY_POPULARITY_DATASET } from '@/models/publicRecords/ingest';
import { counter, type JobReport } from './types';
export async function runPublicRecordsDaily(db: Db, now = new Date()): Promise<JobReport> {
  const started = Date.now(), c = counter();
  if (process.env.NODE_ENV === 'test') return { job: 'daily', startedAt: now.toISOString(), ms: 0, counts: c.counts };
  try { const r = await ingestWashingtonSales(db, { now, maxPages: 3, pageSize: 250 }); c.add('pages', r.pages); c.add('salesKept', r.kept); c.add('salesRejected', r.rejected); } catch { c.add('ingestFailures'); }
  return { job: 'daily', startedAt: now.toISOString(), ms: Date.now() - started, counts: c.counts };
}

export async function runPublicRecordsWeekly(db: Db, now = new Date()): Promise<JobReport> {
  const started = Date.now(), c = counter();
  if (process.env.NODE_ENV === 'test') return { job: 'weekly', startedAt: now.toISOString(), ms: 0, counts: c.counts };
  try {
    const fetchRows = async (dataset: string, state: string) => {
      const u = `https://${state === 'NY' ? 'data.ny.gov' : 'data.wa.gov'}/resource/${dataset}.json?$limit=1000`;
      const res = await fetch(u, { signal: AbortSignal.timeout(12000) }); if (!res.ok) throw new Error(String(res.status));
      return await res.json() as Record<string, unknown>[];
    };
    const out: import('@/models/publicRecords/ingest').PopularityRow[] = [];
    for (const [dataset, state] of [[WA_POPULARITY_DATASET, 'WA'], [NY_POPULARITY_DATASET, 'NY']] as const) {
      const rows = await fetchRows(dataset, state);
      for (const r of rows) { const make = String(r.make ?? '').trim(), model = String(r.model ?? '').trim(), year = Number(r.model_year), period = String(r.start_of_month ?? r.reg_valid_date ?? `${now.getUTCFullYear()}-01-01`).slice(0, 10); const count = Number(r.vehicle_record_count ?? 1); if (make && model && Number.isFinite(year) && Number.isFinite(count)) out.push({ sourceDataset: dataset, state, make, model, modelYear: year, period, vehicleCount: count }); }
    }
    c.add('rows', await refreshPopularity(db, out, now));
  } catch { c.add('refreshFailures'); }
  return { job: 'weekly', startedAt: now.toISOString(), ms: Date.now() - started, counts: c.counts };
}
