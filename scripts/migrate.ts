/** Applies drizzle/ migrations to DATABASE_URL (Postgres URL, or pglite:<dir> for local development). */
import { mkdirSync } from 'node:fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
if (url.startsWith('pglite:')) {
  const dir = url.slice('pglite:'.length);
  mkdirSync(dir, { recursive: true });
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzleLite } = await import('drizzle-orm/pglite');
  const { migrate: migrateLite } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(dir);
  await migrateLite(drizzleLite(client), { migrationsFolder: 'drizzle' });
  await client.close();
} else {
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
  await client.end();
}
console.log('Migrations applied.');
