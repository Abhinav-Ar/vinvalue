/**
 * The only place route code learns who the caller is. Tests replace this
 * with `setTestUser()` instead of standing up Auth.js.
 */
let testUser: string | null | undefined;

export function setTestUser(userId: string | null | undefined) {
  testUser = userId;
}

export async function currentUserId(): Promise<string | null> {
  if (testUser !== undefined) return testUser;
  if (process.env.NODE_ENV === 'test') return null;
  // Local development without Google OAuth: act as this (seeded) user. Ignored outside `next dev`.
  if (process.env.NODE_ENV === 'development' && process.env.DEV_USER_EMAIL) return devUserId(process.env.DEV_USER_EMAIL);
  const { auth } = await import('./auth');
  const session = await auth();
  return session?.user?.id ?? null;
}

let devUserCache: { email: string; id: string } | null = null;
async function devUserId(email: string): Promise<string | null> {
  if (devUserCache?.email === email) return devUserCache.id;
  const [{ getDb }, { users }, { eq }] = await Promise.all([import('./db'), import('./db/schema'), import('drizzle-orm')]);
  const [u] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!u) return null;
  devUserCache = { email, id: u.id };
  return u.id;
}
