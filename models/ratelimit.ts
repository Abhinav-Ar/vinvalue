import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { AppError } from './errors';
import { getDb } from './db';
import { rateLimits } from '../models/db/schema';

/**
 * Fixed-window rate limit stored in Postgres (no extra paid service; works
 * across serverless instances). Keys are hashed; raw IPs are never stored.
 */
export type RateLimitRule = { id: string; limit: number; windowSec: number };

export const RULES = {
  decode: { id: 'decode', limit: 30, windowSec: 600 },
  appraise: { id: 'appraise', limit: 10, windowSec: 600 },
  priceCheck: { id: 'price_check', limit: 10, windowSec: 600 },
  market: { id: 'market', limit: 30, windowSec: 600 },
  smsSend: { id: 'sms_send', limit: 3, windowSec: 3600 },
} satisfies Record<string, RateLimitRule>;

export function clientId(req: Request, userId: string | null): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `ip:${fwd || req.headers.get('x-real-ip') || 'unknown'}`;
}

export async function checkRateLimit(req: Request, rule: RateLimitRule, userId: string | null) {
  // Local/test escape hatch only; production always enforces limits.
  if (process.env.RATE_LIMIT_DISABLED === '1' && process.env.NODE_ENV !== 'production') return;
  const now = Date.now();
  const windowStart = Math.floor(now / (rule.windowSec * 1000)) * rule.windowSec * 1000;
  const key = createHash('sha256')
    .update(`${rule.id}|${clientId(req, userId)}|${windowStart}|${process.env.AUTH_SECRET ?? ''}`)
    .digest('hex');
  const expiresAt = new Date(windowStart + rule.windowSec * 1000);
  const db = getDb();
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  if (row && row.count > rule.limit) {
    const retryAfter = Math.ceil((expiresAt.getTime() - now) / 1000);
    throw new AppError(429, 'rate_limited', 'Too many requests. Try again shortly.', undefined, { retryAfterSec: retryAfter });
  }
}

/** Called by the daily job. */
export async function purgeExpiredRateLimits() {
  await getDb().delete(rateLimits).where(sql`${rateLimits.expiresAt} < now()`);
}
