/**
 * The only module that persists alerts. Feature modules hand in AlertDrafts;
 * this dedupes on (userId, dedupeKey) and enqueues alert_deliveries per prefs.
 * In-app needs no delivery row (the alert row itself is the in-app item).
 */
import { inArray, sql } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { alertDeliveries, alerts, pushSubscriptions } from '@/models/db/schema';
import type { AlertDraft } from '@/shared/contracts';
import type { Channel } from '@/models/config/notifications';
import { log } from '@/models/log';
import { loadNotifyContexts, type UserNotifyContext } from './prefs';
import { quietWindowEnd } from './quiet';

type AlertRow = typeof alerts.$inferSelect;
type DeliveryInsert = typeof alertDeliveries.$inferInsert;

/** Decide outbox rows for one created alert. Pure; exported for tests. */
export function planDeliveries(
  alert: Pick<AlertRow, 'id' | 'type'>,
  ctx: UserNotifyContext,
  hasPush: boolean,
  now: Date,
): DeliveryInsert[] {
  const prefs = ctx.matrix[alert.type];
  const isRecall = alert.type === 'recall';
  const quietEnd = isRecall ? null : quietWindowEnd(now, ctx.timeZone, ctx.quietStart, ctx.quietEnd);
  const notBefore = quietEnd ?? now;
  const rows: DeliveryInsert[] = [];
  const add = (channel: Channel, status: 'pending' | 'digest') =>
    rows.push({ alertId: alert.id, channel, status, notBefore: status === 'digest' ? null : notBefore, createdAt: now });

  if (prefs.email && ctx.hasEmail) {
    const instant = ctx.emailDigest === 'instant' || (ctx.emailDigest === 'recalls_instant_rest_weekly' && isRecall);
    add('email', instant ? 'pending' : 'digest');
  }
  if (prefs.push && hasPush) add('push', 'pending');
  if (prefs.sms && ctx.smsReady) add('sms', 'pending');
  return rows;
}

export async function createAlerts(
  db: Db,
  drafts: AlertDraft[],
  now: Date = new Date(),
): Promise<{ created: number; skippedDuplicates: number; invalid: number }> {
  if (!drafts.length) return { created: 0, skippedDuplicates: 0, invalid: 0 };
  // In-batch dedupe first (same user + key twice in one call).
  const seen = new Set<string>();
  const unique: AlertDraft[] = [];
  for (const d of drafts) {
    const k = `${d.userId}\u0000${d.dedupeKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(d);
  }

  const toRow = (d: AlertDraft) => ({
    userId: d.userId, type: d.type, vehicleId: d.vehicleId ?? null, title: d.title, body: d.body,
    link: d.link ?? null, dedupeKey: d.dedupeKey, createdAt: now,
  });
  const insert = (chunk: AlertDraft[]) =>
    db.insert(alerts).values(chunk.map(toRow)).onConflictDoNothing({ target: [alerts.userId, alerts.dedupeKey] }).returning();

  const created: AlertRow[] = [];
  let invalid = 0;
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    try {
      created.push(...(await insert(chunk)));
    } catch {
      // One bad draft (e.g. a vehicle or user deleted mid-run -> FK violation) must not drop the
      // whole chunk: retry row by row and skip the bad ones.
      for (const d of chunk) {
        try {
          created.push(...(await insert([d])));
        } catch (err) {
          invalid++;
          log.warn('alerts.invalid_draft', { type: d.type, err });
        }
      }
    }
  }

  if (created.length) {
    const userIds = [...new Set(created.map((a) => a.userId))];
    const ctxs = await loadNotifyContexts(db, userIds);
    const pushCounts = await db
      .select({ userId: pushSubscriptions.userId, n: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds))
      .groupBy(pushSubscriptions.userId);
    const hasPush = new Set(pushCounts.filter((r) => Number(r.n) > 0).map((r) => r.userId));
    const outbox: DeliveryInsert[] = [];
    for (const a of created) {
      const ctx = ctxs.get(a.userId);
      if (ctx) outbox.push(...planDeliveries(a, ctx, hasPush.has(a.userId), now));
    }
    for (let i = 0; i < outbox.length; i += 500) await db.insert(alertDeliveries).values(outbox.slice(i, i + 500));
    log.info('alerts.created', { created: created.length, deliveries: outbox.length });
  }
  return { created: created.length, skippedDuplicates: drafts.length - created.length - invalid, invalid };
}
