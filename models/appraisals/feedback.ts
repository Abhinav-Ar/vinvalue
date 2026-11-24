import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { appraisals, saleFeedback, saleOutcomes } from '@/models/db/schema';
import { requireVehicle } from '@/models/ownership';
import { notFound } from '@/models/errors';

export async function ensureFeedback(db: Db, userId: string, vehicleId: string, reason: 'sold' | 'removed' | 'planned') {
  const v = await requireVehicle(db, userId, vehicleId);
  const [appraisal] = await db.select({ id: appraisals.id }).from(appraisals).where(and(eq(appraisals.vehicleId, v.id), eq(appraisals.userId, userId))).orderBy(desc(appraisals.createdAt)).limit(1);
  const snapshot = { make: v.specs.make, model: v.specs.model, year: v.specs.year, trim: v.trim, miles: v.odometer };
  const [row] = await db.insert(saleFeedback).values({ userId, vehicleKey: v.id, snapshot, appraisalId: appraisal?.id ?? null, reason })
    .onConflictDoUpdate({ target: saleFeedback.vehicleKey, set: reason === 'planned' ? { snapshot, appraisalId: appraisal?.id ?? null } : { snapshot, appraisalId: appraisal?.id ?? null, reason } }).returning();
  // Existing outcomes suppress prompts even if recorded before this feature.
  const [outcome] = await db.select().from(saleOutcomes).where(eq(saleOutcomes.vehicleId, v.id)).limit(1);
  if (outcome) {
    await db.update(saleFeedback).set({ completed: true }).where(eq(saleFeedback.id, row!.id));
    return { ...row!, completed: true };
  }
  return row!;
}
export async function listFeedback(db: Db, userId: string) {
  return db.select().from(saleFeedback).where(and(eq(saleFeedback.userId, userId), eq(saleFeedback.dismissed, false), eq(saleFeedback.completed, false)));
}
export async function dismissFeedback(db: Db, userId: string, id: string) {
  const [row] = await db.update(saleFeedback).set({ dismissed: true }).where(and(eq(saleFeedback.id, id), eq(saleFeedback.userId, userId))).returning();
  if (!row) throw notFound('Sale prompt');
}
