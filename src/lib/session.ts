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
  const { auth } = await import('./auth');
  const session = await auth();
  return session?.user?.id ?? null;
}
