import { and, eq } from 'drizzle-orm';
import type { Db } from './db';
import { vehicles, buyChecks } from './db/schema';
import { notFound } from './errors';

/** Load a vehicle owned by userId or throw 404 (never 403, so ids do not leak). */
export async function requireVehicle(db: Db, userId: string, vehicleId: string) {
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, userId))).limit(1);
  if (!v) throw notFound('Vehicle');
  return v;
}

export async function requireBuyCheck(db: Db, userId: string, id: string) {
  const [b] = await db.select().from(buyChecks).where(and(eq(buyChecks.id, id), eq(buyChecks.userId, userId))).limit(1);
  if (!b) throw notFound('Saved price check');
  return b;
}
