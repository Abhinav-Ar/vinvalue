/**
 * Outbox worker: sends pending alert_deliveries whose notBefore has passed.
 * Retries with backoff up to config.maxDeliveryAttempts; permanent provider
 * errors fail immediately. lastError holds only a short code (no PII).
 */
import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { alertDeliveries, alerts, notificationSettings, pushSubscriptions, users } from '@/lib/db/schema';
import { notificationsConfig as cfg } from '@/config/notifications';
import { log } from '@/lib/log';
import { smsReady } from '@/lib/alerts/prefs';
import { alertEmail, alertSms } from './content';
import { SendError, type Senders } from './types';

export type DrainReport = { picked: number; sent: number; retried: number; failed: number; skipped: number; pushGone: number };

type Outcome = { status: 'sent' } | { status: 'skipped' } | { status: 'error'; code: string; retryable: boolean };

function errCode(err: unknown): { code: string; retryable: boolean } {
  if (err instanceof SendError) return { code: err.code, retryable: err.retryable };
  return { code: err instanceof Error ? err.name.slice(0, 40) : 'unknown', retryable: true };
}

export async function drainDeliveries(db: Db, now: Date, senders: Senders): Promise<DrainReport> {
  const report: DrainReport = { picked: 0, sent: 0, retried: 0, failed: 0, skipped: 0, pushGone: 0 };
  const rows = await db
    .select({
      id: alertDeliveries.id, channel: alertDeliveries.channel, attempts: alertDeliveries.attempts,
      alertId: alerts.id, userId: alerts.userId, title: alerts.title, body: alerts.body, link: alerts.link,
    })
    .from(alertDeliveries)
    .innerJoin(alerts, eq(alerts.id, alertDeliveries.alertId))
    .where(and(eq(alertDeliveries.status, 'pending'), or(isNull(alertDeliveries.notBefore), lte(alertDeliveries.notBefore, now))))
    .orderBy(asc(alertDeliveries.createdAt))
    .limit(cfg.drainBatchSize);
  report.picked = rows.length;
  if (!rows.length) return report;

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const [us, ss, subs] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds)),
    db.select().from(notificationSettings).where(inArray(notificationSettings.userId, userIds)),
    db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds)),
  ]);
  const goneEndpoints = new Set<string>();

  for (const r of rows) {
    const content = { title: r.title, body: r.body, link: r.link };
    let outcome: Outcome;
    try {
      if (r.channel === 'email') {
        const to = us.find((u) => u.id === r.userId)?.email;
        if (!to) outcome = { status: 'skipped' };
        else {
          await senders.email.send({ to, ...alertEmail(content), idempotencyKey: `delivery-${r.id}` });
          outcome = { status: 'sent' };
        }
      } else if (r.channel === 'sms') {
        const s = ss.find((x) => x.userId === r.userId);
        // Re-check at send time: the user may have removed the number since enqueue.
        if (!smsReady(s) || !s?.phoneE164) outcome = { status: 'skipped' };
        else {
          await senders.sms.send({ to: s.phoneE164, body: alertSms(content) });
          outcome = { status: 'sent' };
        }
      } else if (r.channel === 'push') {
        const targets = subs.filter((x) => x.userId === r.userId && !goneEndpoints.has(x.endpoint));
        let sent = 0;
        let lastErr: unknown = null;
        for (const t of targets) {
          try {
            const res = await senders.push.send({ endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth }, content);
            if (res === 'gone') {
              goneEndpoints.add(t.endpoint);
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, t.id));
              report.pushGone++;
            } else sent++;
          } catch (err) {
            lastErr = err;
          }
        }
        if (sent > 0) outcome = { status: 'sent' };
        else if (lastErr) outcome = { status: 'error', ...errCode(lastErr) };
        else outcome = { status: 'skipped' }; // no live subscriptions left
      } else {
        outcome = { status: 'skipped' }; // in_app never has outbox rows
      }
    } catch (err) {
      outcome = { status: 'error', ...errCode(err) };
    }

    const attempts = r.attempts + 1;
    const o: Outcome = outcome;
    if (o.status === 'sent') {
      await db.update(alertDeliveries).set({ status: 'sent', attempts, sentAt: now, lastError: null }).where(eq(alertDeliveries.id, r.id));
      report.sent++;
    } else if (o.status === 'skipped') {
      await db.update(alertDeliveries).set({ status: 'skipped', attempts: r.attempts }).where(eq(alertDeliveries.id, r.id));
      report.skipped++;
    } else if (!o.retryable || attempts >= cfg.maxDeliveryAttempts) {
      await db.update(alertDeliveries).set({ status: 'failed', attempts, lastError: o.code }).where(eq(alertDeliveries.id, r.id));
      report.failed++;
    } else {
      const delayMin = cfg.retryBackoffMinutes[Math.min(attempts - 1, cfg.retryBackoffMinutes.length - 1)]!;
      await db
        .update(alertDeliveries)
        .set({ attempts, lastError: o.code, notBefore: new Date(now.getTime() + delayMin * 60_000) })
        .where(eq(alertDeliveries.id, r.id));
      report.retried++;
    }
  }
  log.info('notify.drain', { ...report });
  return report;
}
