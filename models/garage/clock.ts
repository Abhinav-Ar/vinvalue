import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { users } from '@/models/db/schema';
import { dateInZone } from './dates';

/** Today's date (YYYY-MM-DD) in the user's time zone. Routes call this; library code takes `today` as an argument. */
export async function todayFor(db: Db, userId: string, now: Date = new Date()): Promise<string> {
  const [u] = await db.select({ tz: users.timeZone }).from(users).where(eq(users.id, userId)).limit(1);
  return dateInZone(now, u?.tz ?? 'America/Chicago');
}
