import { Pool } from "pg";

const globalForDb = globalThis;

export const db = globalForDb.__autoiqPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 4,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 8_000,
});

if (process.env.NODE_ENV !== "production") globalForDb.__autoiqPool = db;

export async function query(text, values = []) {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return db.query(text, values);
}
