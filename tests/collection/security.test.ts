import { afterEach, it, expect, vi } from 'vitest';
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/models/auth', () => ({ auth }));
import { currentUserId, setTestUser } from '@/models/session';
afterEach(() => { vi.unstubAllEnvs(); setTestUser(undefined); });
it('production ignores DEV_USER_EMAIL and consults the live session on every request', async () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('DEV_USER_EMAIL', 'admin@example.test');
  setTestUser(undefined);
  auth.mockResolvedValueOnce({ user: { id: 'real-session-user' } }).mockResolvedValueOnce(null);
  expect(await currentUserId()).toBe('real-session-user');
  expect(await currentUserId()).toBeNull();
  expect(auth).toHaveBeenCalledTimes(2);
});

it('production rejects fixture-provider and embedded-database shortcuts', async () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PROVIDERS', 'fixtures');
  vi.stubEnv('MARKETCHECK_API_KEY', ''); vi.stubEnv('DATABASE_URL', 'pglite:should-never-open');
  vi.stubEnv('MARKET_DATA_PROVIDER', '');
  const { getProviders, setProviders } = await import('@/models/providers');
  const { PublicRecordsListingsProvider } = await import('@/models/providers/publicRecords');
  setProviders(null);
  // Production never serves fixture data: PROVIDERS=fixtures is ignored and the free public-records source is used.
  expect(getProviders().listings).toBeInstanceOf(PublicRecordsListingsProvider);
  // A leftover MarketCheck key alone must not switch the paid provider back on.
  vi.stubEnv('MARKETCHECK_API_KEY', 'retired-key');
  expect(getProviders().listings).toBeInstanceOf(PublicRecordsListingsProvider);
  const { getDb, setDb } = await import('@/models/db'); setDb(null);
  expect(() => getDb()).toThrow('for local development only');
});
