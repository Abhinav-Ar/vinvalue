import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { createRequire } from 'node:module';
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
    if (url.startsWith('pglite:')) {
      // Local development only: embedded Postgres in a folder (no server). One process at a time.
      if (process.env.NODE_ENV === 'production') throw new Error('pglite: DATABASE_URL is for local development only');
      const req = createRequire(import.meta.url);
      const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
      const { drizzle } = req('drizzle-orm/pglite') as typeof import('drizzle-orm/pglite');
      real = drizzle(new PGlite(url.slice('pglite:'.length)), { schema }) as unknown as Db;
      return real;
    }
    // prepare:false keeps us compatible with poolers (Neon/Supabase pgbouncer).
    const client = postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX ?? 5) });
    real = drizzlePg(client, { schema }) as unknown as Db;
  }
  return real;
}
