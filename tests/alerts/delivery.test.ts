import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser } from '../helpers/db';
import type { Db } from '@/models/db';
import { alertDeliveries, pushSubscriptions } from '@/models/db/schema';
import { createAlerts } from '@/models/alerts/service';
import { drainDeliveries } from '@/models/notify/drain';
import { buildWeeklyDigests } from '@/models/notify/digest';
import { removePhone } from '@/models/alerts/phone';
import { SendError } from '@/models/notify';
import type { AlertDraft } from '@/shared/contracts';
import { addPushSub, recordingSenders, setSettings, verifiedSms, freshDb } from './helpers';

let db: Db;
let userId: string;
const NOW = new Date('2026-11-12T18:00:00Z');
const draft = (over: Partial<AlertDraft> = {}): AlertDraft => ({
  userId, type: 'maintenance', title: 'Oil change is due', body: 'Mustang GT, due Nov 20.', link: '/garage', dedupeKey: 'k1', ...over,
});
const status = async () => (await db.select().from(alertDeliveries)).map((d) => ({ channel: d.channel, status: d.status, attempts: d.attempts, lastError: d.lastError }));

beforeEach(async () => {
  db = await freshDb();
  userId = (await createUser(db)).id;
}, 120000);

describe('drainDeliveries', () => {
  it('sends every channel and marks rows sent', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await verifiedSms(db, userId);
    await addPushSub(db, userId);
    await createAlerts(db, [draft({ type: 'recall', title: 'New recall notice to review', dedupeKey: 'r' })], NOW);
    const s = recordingSenders();
    const r = await drainDeliveries(db, NOW, s);
    expect(r).toMatchObject({ picked: 3, sent: 3 });
    expect(s.rec.email[0]!.subject).toBe('New recall notice to review');
    expect(s.rec.email[0]!.text).toContain('http://localhost:3000/garage');
    expect(s.rec.sms[0]!.to).toBe('+15555550123');
    expect(s.rec.push).toHaveLength(1);
    expect((await status()).every((d) => d.status === 'sent')).toBe(true);
    expect((await drainDeliveries(db, NOW, s)).picked).toBe(0);
  });

  it('waits for notBefore (quiet hours)', async () => {
    await setSettings(db, userId, { emailDigest: 'instant', quietStart: '00:00', quietEnd: '23:59' });
    await createAlerts(db, [draft()], NOW);
    const s = recordingSenders();
    expect((await drainDeliveries(db, NOW, s)).picked).toBe(0);
    expect((await drainDeliveries(db, new Date(NOW.getTime() + 24 * 3600_000), s)).sent).toBe(1);
  });

  it('retries with backoff, then fails after 3 attempts; no PII in lastError', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft()], NOW);
    const s = recordingSenders({ emailError: () => new SendError('resend_http_500', true) });
    await drainDeliveries(db, NOW, s);
    expect(await status()).toEqual([{ channel: 'email', status: 'pending', attempts: 1, lastError: 'resend_http_500' }]);
    expect((await drainDeliveries(db, NOW, s)).picked).toBe(0); // backoff not elapsed
    const later = (min: number) => new Date(NOW.getTime() + min * 60_000);
    await drainDeliveries(db, later(6), s);
    expect((await status())[0]).toMatchObject({ status: 'pending', attempts: 2 });
    await drainDeliveries(db, later(60), s);
    expect((await status())[0]).toMatchObject({ status: 'failed', attempts: 3, lastError: 'resend_http_500' });
  });

  it('permanent errors fail immediately', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft()], NOW);
    await drainDeliveries(db, NOW, recordingSenders({ emailError: () => new SendError('resend_http_422', false) }));
    expect((await status())[0]).toMatchObject({ status: 'failed', attempts: 1 });
  });

  it('deletes push subscriptions that return 410 and keeps live ones', async () => {
    const dead = await addPushSub(db, userId, 'https://push.example.test/dead');
    await addPushSub(db, userId, 'https://push.example.test/live');
    await createAlerts(db, [draft()], NOW);
    const s = recordingSenders({ pushResult: (e) => (e === dead ? 'gone' : 'sent') });
    const r = await drainDeliveries(db, NOW, s);
    expect(r.pushGone).toBe(1);
    const subs = await db.select().from(pushSubscriptions);
    expect(subs.map((x) => x.endpoint)).toEqual(['https://push.example.test/live']);
    expect((await status()).find((d) => d.channel === 'push')!.status).toBe('sent');
  });

  it('push with only dead subscriptions is skipped', async () => {
    await addPushSub(db, userId);
    await createAlerts(db, [draft()], NOW);
    await drainDeliveries(db, NOW, recordingSenders({ pushResult: () => 'gone' }));
    expect((await status()).find((d) => d.channel === 'push')!.status).toBe('skipped');
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it('removing the phone skips queued texts', async () => {
    await verifiedSms(db, userId);
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'r' })], NOW);
    await removePhone(db, userId);
    const s = recordingSenders();
    await drainDeliveries(db, NOW, s);
    expect(s.rec.sms).toHaveLength(0);
    expect((await status()).find((d) => d.channel === 'sms')!.status).toBe('skipped');
  });
});

describe('buildWeeklyDigests', () => {
  it('groups digest rows per user into one email', async () => {
    const other = (await createUser(db)).id;
    await createAlerts(db, [draft({ dedupeKey: 'a' }), draft({ dedupeKey: 'b', title: 'Insurance renews Nov 24', type: 'renewal' }), draft({ userId: other, dedupeKey: 'c' })], NOW);
    const s = recordingSenders();
    const r = await buildWeeklyDigests(db, NOW, s);
    expect(r).toEqual({ users: 2, sent: 2, failed: 0, items: 3 });
    expect(s.rec.email).toHaveLength(2);
    const mine = s.rec.email.find((e) => e.subject.includes('2 alerts'))!;
    expect(mine.text).toContain('Insurance renews Nov 24');
    expect(mine.text).not.toMatch(/—/);
    expect((await status()).every((d) => d.status === 'sent')).toBe(true);
    expect((await buildWeeklyDigests(db, NOW, s)).items).toBe(0);
  });

  it('keeps rows for next week on a retryable failure', async () => {
    await createAlerts(db, [draft()], NOW);
    await buildWeeklyDigests(db, NOW, recordingSenders({ emailError: () => new SendError('resend_network', true) }));
    const [d] = await db.select().from(alertDeliveries).where(eq(alertDeliveries.channel, 'email'));
    expect(d).toMatchObject({ status: 'digest', attempts: 1, lastError: 'resend_network' });
  });
});
