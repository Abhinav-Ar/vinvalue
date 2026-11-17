import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError } from '@/models/errors';

/**
 * Vercel cron sends `Authorization: Bearer $CRON_SECRET`. 503 when the secret
 * is not configured (never run open), 401 on a missing or wrong header.
 */
export function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new AppError(503, 'not_configured', 'Scheduled jobs are not configured on this server.');
  const got = req.headers.get('authorization') ?? '';
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  if (!timingSafeEqual(a, b)) throw new AppError(401, 'unauthorized', 'Missing or wrong cron secret.');
}
