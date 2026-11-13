import { afterEach } from 'vitest';
import { setTestUser } from '@/lib/session';

process.env.RATE_LIMIT_DISABLED ??= '1';

afterEach(() => {
  setTestUser(undefined);
});
