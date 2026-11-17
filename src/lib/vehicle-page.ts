import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { vehicles } from '@/lib/db/schema';
import { currentUserId } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For /garage/[vehicleId] pages: false means render a real 404 (bad id, or not this user's car).
 * Signed-out visitors get true so the client shows its sign-in note; a DB error also gets true so the
 * client reports the API error with a retry.
 */
export async function vehiclePageExists(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  try {
    const userId = await currentUserId();
    if (!userId) return true;
    const [v] = await getDb().select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId))).limit(1);
    return !!v;
  } catch {
    return true;
  }
}
