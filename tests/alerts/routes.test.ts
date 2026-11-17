import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser } from '../helpers/db';
import type { Db } from '@/models/db';
import { alerts, notificationSettings, pushSubscriptions, smsVerifications } from '@/models/db/schema';
import { setTestUser } from '@/models/session';
import { setSenders } from '@/models/notify';
import { createAlerts } from '@/models/alerts/service';
import { normalizeUsPhone } from '@/models/alerts/phone';
import * as alertsRoute from '@/app/api/alerts/route';
import * as readRoute from '@/app/api/alerts/[id]/read/route';
import * as readAllRoute from '@/app/api/alerts/read-all/route';
import * as prefsRoute from '@/app/api/notification-prefs/route';
import * as sendCodeRoute from '@/app/api/phone/send-code/route';
import * as verifyRoute from '@/app/api/phone/verify/route';
import * as phoneRoute from '@/app/api/phone/route';
import * as pushRoute from '@/app/api/push-subscriptions/route';
import * as vapidRoute from '@/app/api/push-subscriptions/vapid-key/route';
import { addVehicle, recordingSenders, freshDb } from './helpers';

let db: Db;
let me: string;
let other: string;
const BASE = 'http://localhost:3000';
const req = (path: string, method = 'GET', body?: unknown) =>
  new Request(`${BASE}${path}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
const ctx = <P extends Record<string, string>>(p: P) => ({ params: Promise.resolve(p) });

beforeEach(async () => {
  db = await freshDb();
  me = (await createUser(db)).id;
  other = (await createUser(db)).id;
}, 120000);
afterEach(() => setSenders(null));

describe('alerts routes', () => {
  it('401 when signed out', async () => {
    setTestUser(null);
    expect((await alertsRoute.GET(req('/api/alerts'))).status).toBe(401);
  });

  it('lists own alerts with vehicle badge, filters, paginates, and enforces ownership', async () => {
    const v = await addVehicle(db, me);
    const t0 = new Date('2026-11-01T00:00:00Z').getTime();
    for (let i = 0; i < 25; i++) {
      await createAlerts(db, [{ userId: me, type: i % 2 ? 'value' : 'maintenance', vehicleId: v.id, title: `A${i}`, body: 'b', dedupeKey: `k${i}` }], new Date(t0 + i * 60_000));
    }
    await createAlerts(db, [{ userId: other, type: 'recall', title: 'theirs', body: 'b', dedupeKey: 'x' }], new Date(t0));
    setTestUser(me);
    const r1 = await (await alertsRoute.GET(req('/api/alerts'))).json();
    expect(r1.items).toHaveLength(20);
    expect(r1.unreadCount).toBe(25);
    expect(r1.items[0]).toMatchObject({ title: 'A24', type: 'maintenance', read: false, vehicle: { id: v.id, label: 'Mustang GT', badge: 'M' } });
    const r2 = await (await alertsRoute.GET(req(`/api/alerts?cursor=${r1.nextCursor}`))).json();
    expect(r2.items.map((x: { title: string }) => x.title)).toEqual(['A4', 'A3', 'A2', 'A1', 'A0']);
    expect(r2.nextCursor).toBeNull();
    const vals = await (await alertsRoute.GET(req('/api/alerts?filter=value'))).json();
    expect(vals.items.every((x: { type: string }) => x.type === 'value')).toBe(true);
    expect((await alertsRoute.GET(req('/api/alerts?filter=bogus'))).status).toBe(400);

    const [theirs] = await db.select().from(alerts).where(eq(alerts.userId, other));
    expect((await readRoute.PATCH(req(`/api/alerts/${theirs!.id}/read`, 'PATCH'), ctx({ id: theirs!.id }))).status).toBe(404);
    const mine = r1.items[0].id;
    const ok = await readRoute.PATCH(req(`/api/alerts/${mine}/read`, 'PATCH'), ctx({ id: mine }));
    expect(await ok.json()).toEqual({ id: mine, read: true });
    const unread = await (await alertsRoute.GET(req('/api/alerts?filter=unread'))).json();
    expect(unread.unreadCount).toBe(24);

    expect(await (await readAllRoute.POST(req('/api/alerts/read-all', 'POST'))).json()).toEqual({ updated: 24 });
    const [stillUnread] = await db.select().from(alerts).where(eq(alerts.userId, other));
    expect(stillUnread!.readAt).toBeNull();
  });
});

describe('in-app preference', () => {
  it('hides types switched off for in-app from the list and unread count', async () => {
    await createAlerts(db, [
      { userId: me, type: 'market', title: 'Listings up', body: 'b', dedupeKey: 'm' },
      { userId: me, type: 'recall', title: 'New recall notice to review', body: 'b', dedupeKey: 'r' },
    ], new Date('2026-11-01T00:00:00Z'));
    setTestUser(me);
    expect((await (await alertsRoute.GET(req('/api/alerts'))).json()).unreadCount).toBe(2);
    await prefsRoute.PUT(req('/api/notification-prefs', 'PUT', { matrix: { market: { in_app: false } } }));
    const r = await (await alertsRoute.GET(req('/api/alerts'))).json();
    expect(r.items.map((x: { type: string }) => x.type)).toEqual(['recall']);
    expect(r.unreadCount).toBe(1);
  });
});

describe('notification prefs routes', () => {
  it('GET returns defaults; PUT overrides and validates', async () => {
    setTestUser(me);
    const g = await (await prefsRoute.GET(req('/api/notification-prefs'))).json();
    expect(g).toMatchObject({ emailDigest: 'recalls_instant_rest_weekly', quietStart: null, quietEnd: null, timeZone: 'America/Chicago', phone: null });
    expect(g.matrix.renewal).toEqual({ in_app: true, email: true, push: false, sms: true });

    const p = await prefsRoute.PUT(req('/api/notification-prefs', 'PUT', {
      matrix: { market: { email: true } }, emailDigest: 'weekly', quietStart: '22:00', quietEnd: '07:00', timeZone: 'America/Los_Angeles',
    }));
    expect(p.status).toBe(200);
    const pj = await p.json();
    expect(pj).toMatchObject({ emailDigest: 'weekly', quietStart: '22:00', quietEnd: '07:00', timeZone: 'America/Los_Angeles' });
    expect(pj.matrix.market).toEqual({ in_app: true, email: true, push: false, sms: false });

    const bad = async (body: unknown) => (await prefsRoute.PUT(req('/api/notification-prefs', 'PUT', body))).status;
    expect(await bad({ matrix: { recall: { in_app: false } } })).toBe(400);
    expect(await bad({ quietStart: '25:00' })).toBe(400);
    expect(await bad({ timeZone: 'Mars/Olympus' })).toBe(400);
    expect(await bad({ quietStart: null })).toBe(400); // end still set
    expect(await bad({ matrix: { bogus: { email: true } } })).toBe(400);
  });
});

describe('phone verification', () => {
  const consentText = 'I agree to receive AutoIQ alert texts. Msg and data rates may apply. Reply STOP to opt out.';

  it('normalizes US numbers', () => {
    expect(normalizeUsPhone('(555) 555-0123')).toBe('+15555550123');
    expect(normalizeUsPhone('+1 555.555.0123')).toBe('+15555550123');
    expect(normalizeUsPhone('15555550123')).toBe('+15555550123');
    expect(normalizeUsPhone('+44 20 7946 0958')).toBeNull();
    expect(normalizeUsPhone('055-555-0123')).toBeNull();
    expect(normalizeUsPhone('555-0123')).toBeNull();
  });

  async function sendCode() {
    const s = recordingSenders();
    setSenders(s);
    setTestUser(me);
    const r = await sendCodeRoute.POST(req('/api/phone/send-code', 'POST', { phone: '(555) 555-0123', consent: true, consentText }));
    expect(r.status).toBe(202);
    expect((await r.json()).phone).toEqual({ masked: '(***) ***-0123', verified: false });
    const code = s.rec.sms[0]!.body.match(/\b(\d{6})\b/)![1]!;
    return code;
  }

  it('requires consent', async () => {
    setTestUser(me);
    const r = await sendCodeRoute.POST(req('/api/phone/send-code', 'POST', { phone: '5555550123', consent: false, consentText }));
    expect(r.status).toBe(400);
  });

  it('stores only a hash and verifies; sets phone, verifiedAt, consent', async () => {
    const code = await sendCode();
    const [v] = await db.select().from(smsVerifications);
    expect(v!.codeHash).not.toContain(code);
    // Not recorded as consented before verification.
    expect(await db.select().from(notificationSettings)).toHaveLength(0);
    const ok = await verifyRoute.POST(req('/api/phone/verify', 'POST', { code }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ phone: { masked: '(***) ***-0123', verified: true } });
    const [s] = await db.select().from(notificationSettings);
    expect(s).toMatchObject({ phoneE164: '+15555550123', smsConsentText: consentText });
    expect(s!.phoneVerifiedAt).toBeTruthy();
    expect(s!.smsConsentAt).toBeTruthy();
    const g = await (await prefsRoute.GET(req('/api/notification-prefs'))).json();
    expect(g.phone).toEqual({ masked: '(***) ***-0123', verified: true });
    // Code is single use.
    expect((await verifyRoute.POST(req('/api/phone/verify', 'POST', { code }))).status).toBe(400);

    const del = await phoneRoute.DELETE(req('/api/phone', 'DELETE'));
    expect(await del.json()).toEqual({ phone: null });
    const [after] = await db.select().from(notificationSettings);
    expect(after).toMatchObject({ phoneE164: null, phoneVerifiedAt: null, smsConsentAt: null });
  });

  it('locks after 5 wrong attempts', async () => {
    const code = await sendCode();
    const wrong = code === '000000' ? '111111' : '000000';
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await verifyRoute.POST(req('/api/phone/verify', 'POST', { code: wrong }))).status);
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
    expect((await verifyRoute.POST(req('/api/phone/verify', 'POST', { code }))).status).toBe(429);
    expect(await db.select().from(notificationSettings)).toHaveLength(0);
  });

  it('rejects expired codes', async () => {
    const code = await sendCode();
    await db.update(smsVerifications).set({ expiresAt: new Date(Date.now() - 1000) });
    const r = await verifyRoute.POST(req('/api/phone/verify', 'POST', { code }));
    expect(r.status).toBe(400);
    expect((await r.json()).error.message).toContain('expired');
  });

  it('a new code invalidates the previous one', async () => {
    const first = await sendCode();
    const second = await sendCode();
    if (first !== second) expect((await verifyRoute.POST(req('/api/phone/verify', 'POST', { code: first }))).status).toBe(400);
    expect((await verifyRoute.POST(req('/api/phone/verify', 'POST', { code: second }))).status).toBe(200);
  });
});

describe('push subscription routes', () => {
  it('subscribe, re-subscribe moves owner, delete only own', async () => {
    setTestUser(me);
    const body = { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'p', auth: 'a' } };
    expect((await pushRoute.POST(req('/api/push-subscriptions', 'POST', body))).status).toBe(201);
    expect((await pushRoute.POST(req('/api/push-subscriptions', 'POST', { ...body, endpoint: 'http://insecure' }))).status).toBe(400);
    setTestUser(other);
    expect(await (await pushRoute.DELETE(req('/api/push-subscriptions', 'DELETE', { endpoint: body.endpoint }))).json()).toEqual({ removed: 0 });
    await pushRoute.POST(req('/api/push-subscriptions', 'POST', body));
    const [s] = await db.select().from(pushSubscriptions);
    expect(s!.userId).toBe(other);
    expect(await (await pushRoute.DELETE(req('/api/push-subscriptions', 'DELETE', { endpoint: body.endpoint }))).json()).toEqual({ removed: 1 });
  });

  it('vapid key is public; 503 when unset', async () => {
    setTestUser(null);
    vi.stubEnv('VAPID_PUBLIC_KEY', '');
    expect((await vapidRoute.GET(req('/api/push-subscriptions/vapid-key'))).status).toBe(503);
    vi.stubEnv('VAPID_PUBLIC_KEY', 'BPUBLIC');
    expect(await (await vapidRoute.GET(req('/api/push-subscriptions/vapid-key'))).json()).toEqual({ publicKey: 'BPUBLIC' });
    vi.unstubAllEnvs();
  });
});
