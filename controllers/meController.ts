import { eq } from 'drizzle-orm';
import { json, route } from '@/models/http';
import { getDb } from '@/models/db';
import { users } from '@/models/db/schema';
/** GET /api/me: who is signed in (for the nav). Never errors for signed-out callers. */
export const getMe = route({ auth: false, name: 'me' }, async ({ userId }) => {
  if (!userId) return json({ signedIn: false });
  const [u] = await getDb().select({ name: users.name, image: users.image }).from(users).where(eq(users.id, userId)).limit(1);
  return json({ signedIn: true, name: u?.name ?? null, image: u?.image ?? null });
});
