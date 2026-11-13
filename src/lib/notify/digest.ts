/**
 * Weekly email digest: every 'digest' email row is grouped per user into one
 * email. On success the rows become 'sent'; on failure they stay 'digest'
 * (retried next week) until maxDeliveryAttempts, then 'failed'.
 * Quiet hours are not applied: the digest is a scheduled, non-urgent email.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { alertDeliveries, alerts, users } from '@/lib/db/schema';
import { notificationsConfig as cfg } from '@/config/notifications';
import { log } from '@/lib/log';
import { digestEmail } from './content';
import { SendError, type Senders } from './types';
import { getSenders } from './index';

export type DigestReport = { users: number; sent: number; failed: number; items: number };

export async function buildWeeklyDigests(db: Db, now: Date, senders: Senders = getSenders()): Promise<DigestReport> {
  const report: DigestReport = { users: 0, sent: 0, failed: 0, items: 0 };
  const rows = await db
    .select({
      id: alertDeliveries.id, attempts: alertDeliveries.attempts, userId: alerts.userId,
      title: alerts.title, body: alerts.body, link: alerts.link, email: users.email,
    })
    .from(alertDeliveries)
    .innerJoin(alerts, eq(alerts.id, alertDeliveries.alertId))
    .innerJoin(users, eq(users.id, alerts.userId))
    .where(and(eq(alertDeliveries.status, 'digest'), eq(alertDeliveries.channel, 'email')))
    .orderBy(asc(alerts.createdAt));

  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }
  report.users = byUser.size;
  report.items = rows.length;

  for (const [userId, list] of byUser) {
    const ids = list.map((r) => r.id);
    const to = list[0]!.email;
    if (!to) {
      await db.update(alertDeliveries).set({ status: 'skipped' }).where(inArray(alertDeliveries.id, ids));
      continue;
    }
    try {
      const weekKey = now.toISOString().slice(0, 10);
      await senders.email.send({ to, ...digestEmail(list), idempotencyKey: `digest-${userId}-${weekKey}` });
      await db.update(alertDeliveries).set({ status: 'sent', sentAt: now, lastError: null }).where(inArray(alertDeliveries.id, ids));
      report.sent++;
    } catch (err) {
      const code = err instanceof SendError ? err.code : 'unknown';
      const attempts = Math.max(...list.map((r) => r.attempts)) + 1;
      const give = attempts >= cfg.maxDeliveryAttempts || (err instanceof SendError && !err.retryable);
      await db
        .update(alertDeliveries)
        .set({ status: give ? 'failed' : 'digest', attempts, lastError: code })
        .where(inArray(alertDeliveries.id, ids));
      report.failed++;
    }
  }
  log.info('notify.digest', { ...report });
  return report;
}
