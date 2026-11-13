import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser } from '../helpers/db';
import type { Db } from '@/lib/db';
import { alertDeliveries, alerts, users } from '@/lib/db/schema';
import { createAlerts } from '@/lib/alerts/service';
import { loadNotifyContext, maskPhone } from '@/lib/alerts/prefs';
import { quietWindowEnd } from '@/lib/alerts/quiet';
import { DEFAULT_PREFS } from '@/config/notifications';
import type { AlertDraft } from '@/lib/contracts';
import { addPushSub, setPref, setSettings, verifiedSms, freshDb } from './helpers';

let db: Db;
let userId: string;
const NOW = new Date('2026-11-12T18:00:00Z'); // 12:00 in Chicago

const draft = (over: Partial<AlertDraft> = {}): AlertDraft => ({
  userId, type: 'maintenance', title: 'Oil change is due', body: 'Mustang GT, due Nov 20.', link: '/garage', dedupeKey: 'k1', ...over,
});

async function deliveries() {
  const rows = await db.select({ channel: alertDeliveries.channel, status: alertDeliveries.status, notBefore: alertDeliveries.notBefore, type: alerts.type })
    .from(alertDeliveries).innerJoin(alerts, eq(alerts.id, alertDeliveries.alertId));
  return rows;
}

beforeEach(async () => {
  db = await freshDb();
  userId = (await createUser(db)).id;
}, 120000);

describe('createAlerts dedupe', () => {
  it('creates once per (user, dedupeKey), including within one batch', async () => {
    expect(await createAlerts(db, [draft(), draft()], NOW)).toEqual({ created: 1, skippedDuplicates: 1, invalid: 0 });
    expect(await createAlerts(db, [draft(), draft({ dedupeKey: 'k2' })], NOW)).toEqual({ created: 1, skippedDuplicates: 1, invalid: 0 });
    const other = await createUser(db);
    expect(await createAlerts(db, [draft({ userId: other.id })], NOW)).toEqual({ created: 1, skippedDuplicates: 0, invalid: 0 });
    const rows = await db.select().from(alerts);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.createdAt.toISOString()).toBe(NOW.toISOString());
  });

  it('a bad draft (missing vehicle) does not drop the rest of the batch', async () => {
    const r = await createAlerts(db, [draft({ dedupeKey: 'ok1' }), draft({ dedupeKey: 'bad', vehicleId: 'no-such-vehicle' }), draft({ dedupeKey: 'ok2' })], NOW);
    expect(r).toEqual({ created: 2, skippedDuplicates: 0, invalid: 1 });
  });

  it('does not enqueue deliveries for duplicates', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft()], NOW);
    await createAlerts(db, [draft()], NOW);
    expect(await deliveries()).toHaveLength(1);
  });
});

describe('prefs', () => {
  it('defaults match the design matrix', async () => {
    const ctx = await loadNotifyContext(db, userId);
    expect(ctx!.matrix).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.recall).toEqual({ in_app: true, email: true, push: true, sms: true });
    expect(DEFAULT_PREFS.market).toEqual({ in_app: true, email: false, push: false, sms: false });
    expect(DEFAULT_PREFS.renewal).toEqual({ in_app: true, email: true, push: false, sms: true });
    expect(ctx!.emailDigest).toBe('recalls_instant_rest_weekly');
  });

  it('overrides individual cells and never disables recall in_app', async () => {
    await setPref(db, userId, 'market', 'email', true);
    await setPref(db, userId, 'maintenance', 'push', false);
    await setPref(db, userId, 'recall', 'in_app', false);
    const ctx = await loadNotifyContext(db, userId);
    expect(ctx!.matrix.market.email).toBe(true);
    expect(ctx!.matrix.maintenance.push).toBe(false);
    expect(ctx!.matrix.maintenance.email).toBe(true);
    expect(ctx!.matrix.recall.in_app).toBe(true);
  });

  it('masks phone numbers', () => {
    expect(maskPhone('+15555550123')).toBe('(***) ***-0123');
  });
});

describe('delivery fan-out', () => {
  it('instant email + push (with subscription), no sms without verification', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await addPushSub(db, userId);
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'r' })], NOW);
    const d = await deliveries();
    expect(d.map((x) => x.channel).sort()).toEqual(['email', 'push']);
    expect(d.every((x) => x.status === 'pending' && x.notBefore!.getTime() === NOW.getTime())).toBe(true);
  });

  it('no push row without a subscription even if enabled', async () => {
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft()], NOW);
    expect((await deliveries()).map((x) => x.channel)).toEqual(['email']);
  });

  it('sms only when enabled AND verified AND consented', async () => {
    await setSettings(db, userId, { emailDigest: 'instant', phoneE164: '+15555550123', phoneVerifiedAt: NOW }); // no consent
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'a' })], NOW);
    expect((await deliveries()).some((x) => x.channel === 'sms')).toBe(false);

    await verifiedSms(db, userId);
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'b' }), draft({ type: 'value', dedupeKey: 'c' })], NOW);
    const sms = (await deliveries()).filter((x) => x.channel === 'sms');
    expect(sms.map((x) => x.type)).toEqual(['recall']); // value has sms off by default

    await setPref(db, userId, 'recall', 'sms', false);
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'd' })], NOW);
    expect((await deliveries()).filter((x) => x.channel === 'sms')).toHaveLength(1);
  });

  it('digest modes', async () => {
    // default: recalls instant, rest weekly
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'r1' }), draft({ dedupeKey: 'm1' })], NOW);
    let d = await deliveries();
    expect(d.find((x) => x.type === 'recall')!.status).toBe('pending');
    expect(d.find((x) => x.type === 'maintenance')!.status).toBe('digest');
    expect(d.find((x) => x.type === 'maintenance')!.notBefore).toBeNull();

    await db.delete(alertDeliveries);
    await setSettings(db, userId, { emailDigest: 'weekly' });
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'r2' }), draft({ dedupeKey: 'm2' })], NOW);
    d = await deliveries();
    expect(d.map((x) => x.status)).toEqual(['digest', 'digest']);

    await db.delete(alertDeliveries);
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft({ type: 'recall', dedupeKey: 'r3' }), draft({ dedupeKey: 'm3' })], NOW);
    d = await deliveries();
    expect(d.map((x) => x.status)).toEqual(['pending', 'pending']);
  });

  it('skips email when the user has no email address', async () => {
    await db.update(users).set({ email: null }).where(eq(users.id, userId));
    await setSettings(db, userId, { emailDigest: 'instant' });
    await createAlerts(db, [draft()], NOW);
    expect(await deliveries()).toHaveLength(0);
  });
});

describe('quiet hours', () => {
  it('window across midnight in a non-UTC zone (Los Angeles, PST)', () => {
    // 23:30 PST on Nov 12 = 07:30Z Nov 13. Quiet 22:00-07:00 ends 07:00 PST Nov 13 = 15:00Z.
    const now = new Date('2026-11-13T07:30:00Z');
    expect(quietWindowEnd(now, 'America/Los_Angeles', '22:00', '07:00')!.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    // 02:15 PST Nov 13 (10:15Z): still quiet, same end.
    expect(quietWindowEnd(new Date('2026-11-13T10:15:00Z'), 'America/Los_Angeles', '22:00', '07:00')!.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    // 12:00 PST: not quiet.
    expect(quietWindowEnd(new Date('2026-11-13T20:00:00Z'), 'America/Los_Angeles', '22:00', '07:00')).toBeNull();
    // Same-day window and no-window cases.
    expect(quietWindowEnd(new Date('2026-11-13T20:00:00Z'), 'America/Los_Angeles', '11:00', '13:30')!.toISOString()).toBe('2026-11-13T21:30:00.000Z');
    expect(quietWindowEnd(now, 'America/Los_Angeles', '22:00', '22:00')).toBeNull();
    expect(quietWindowEnd(now, 'America/Los_Angeles', null, null)).toBeNull();
  });

  it('handles a DST change inside the window', () => {
    // Night of Nov 1 2026 (US DST ends 02:00). 23:00 PDT Oct 31 = 06:00Z Nov 1; end 07:00 PST = 15:00Z.
    expect(quietWindowEnd(new Date('2026-11-01T06:00:00Z'), 'America/Los_Angeles', '22:00', '07:00')!.toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('delays non-recall deliveries; recalls go now', async () => {
    await db.update(users).set({ timeZone: 'America/Los_Angeles' }).where(eq(users.id, userId));
    await setSettings(db, userId, { emailDigest: 'instant', quietStart: '22:00', quietEnd: '07:00' });
    await addPushSub(db, userId);
    const now = new Date('2026-11-13T07:30:00Z');
    await createAlerts(db, [draft({ dedupeKey: 'm' }), draft({ type: 'recall', dedupeKey: 'r' })], now);
    const d = await deliveries();
    for (const x of d.filter((x) => x.type === 'maintenance')) expect(x.notBefore!.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    for (const x of d.filter((x) => x.type === 'recall')) expect(x.notBefore!.toISOString()).toBe(now.toISOString());
    expect(d.filter((x) => x.type === 'recall')).toHaveLength(2);
  });
});
