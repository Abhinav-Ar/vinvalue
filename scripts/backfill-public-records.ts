import { getDb } from '@/models/db';
import { ingestWashingtonSales } from '@/models/publicRecords/ingest';

const db = getDb();
const result = await ingestWashingtonSales(db, { maxPages: Number(process.env.BACKFILL_PAGES ?? 200), pageSize: 1000, timeBudgetMs: Number(process.env.BACKFILL_BUDGET_MS ?? 60 * 60_000), requestTimeoutMs: 90_000 });
console.log(JSON.stringify(result));
