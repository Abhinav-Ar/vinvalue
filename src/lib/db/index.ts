import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let override: Db | null = null;
let real: Db | null = null;

/** Tests inject a PGlite-backed db here (see tests/helpers/db.ts). */
export function setDb(db: Db | null) {
  override = db;
}

export function getDb(): Db {
  if (override) return override;
  if (!real) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    // prepare:false keeps us compatible with poolers (Neon/Supabase pgbouncer).
    const client = postgres(url, { prepare: false, max: 5 });
    real = drizzlePg(client, { schema }) as unknown as Db;
  }
  return real;
}
