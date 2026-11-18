import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { publicRecordPopularity } from '@/models/db/schema';
export async function getPopularityIndex(db: Db, input: { make: string; model: string; year: number; state?: string }) {
  const rows = await db.select({ count: sql<number>`sum(${publicRecordPopularity.vehicleCount})` }).from(publicRecordPopularity).where(and(eq(publicRecordPopularity.make, input.make.toUpperCase()), eq(publicRecordPopularity.model, input.model.toUpperCase()), eq(publicRecordPopularity.modelYear, input.year), input.state ? eq(publicRecordPopularity.state, input.state.toUpperCase()) : undefined));
  const count = Number(rows[0]?.count ?? 0); return { index: count > 0 ? Math.log10(count + 1) : 0, count };
}
