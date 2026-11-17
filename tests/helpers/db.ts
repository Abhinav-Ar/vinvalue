import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { setDb, type Db } from '@/models/db';
import * as schema from '@/models/db/schema';

/**
 * In-process Postgres (PGlite) with real migrations applied. Call in
 * beforeEach/beforeAll; it installs itself as getDb()'s return value.
 */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: 'drizzle' });
  setDb(db);
  return db;
}

export async function createUser(db: Db, over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [u] = await db.insert(schema.users).values({ name: 'Test User', email: `${crypto.randomUUID()}@example.test`, ...over }).returning();
  return u!;
}
