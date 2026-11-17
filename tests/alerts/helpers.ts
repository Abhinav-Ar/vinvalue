import type { Db } from '@/models/db';
import { notificationPrefs, notificationSettings, pushSubscriptions, vehicles } from '@/models/db/schema';
import { modelKey } from '@/shared/model-key';
import type { Senders, EmailMessage, PushPayload, PushTarget, SmsMessage } from '@/models/notify';

export async function addVehicle(db: Db, userId: string, over: Partial<typeof vehicles.$inferInsert> = {}) {
  const [v] = await db.insert(vehicles).values({
    userId,
    vin: '1FA6P8CF9K5123456',
    specs: {
      year: 2019, make: 'Ford', model: 'Mustang', trimRaw: 'GT', trimCandidates: ['GT'], body: null, drive: null,
      engine: null, fuel: null, doors: 2, plant: null, checkDigitValid: true,
    },
    trim: 'GT',
    modelKey: modelKey('Ford', 'Mustang', 'GT'),
    zip: '60601',
    odometer: 38000,
    lastPrivateValue: 26850,
    ...over,
  }).returning();
  return v!;
}

export async function setSettings(db: Db, userId: string, s: Partial<typeof notificationSettings.$inferInsert>) {
  await db.insert(notificationSettings).values({ userId, ...s }).onConflictDoUpdate({ target: notificationSettings.userId, set: s });
}

export async function verifiedSms(db: Db, userId: string) {
  const t = new Date('2026-01-01T00:00:00Z');
  await setSettings(db, userId, { phoneE164: '+15555550123', phoneVerifiedAt: t, smsConsentAt: t, smsConsentText: 'ok' });
}

export async function setPref(db: Db, userId: string, alertType: typeof notificationPrefs.$inferInsert.alertType, channel: typeof notificationPrefs.$inferInsert.channel, enabled: boolean) {
  await db.insert(notificationPrefs).values({ userId, alertType, channel, enabled })
    .onConflictDoUpdate({ target: [notificationPrefs.userId, notificationPrefs.alertType, notificationPrefs.channel], set: { enabled } });
}

export async function addPushSub(db: Db, userId: string, endpoint = `https://push.example.test/${crypto.randomUUID()}`) {
  await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh: 'p', auth: 'a' });
  return endpoint;
}

export type Recorded = { email: EmailMessage[]; push: { target: PushTarget; payload: PushPayload }[]; sms: SmsMessage[] };

/** Recording senders. pushResult decides per endpoint: 'sent' | 'gone' | Error. */
export function recordingSenders(opts: {
  pushResult?: (endpoint: string) => 'sent' | 'gone' | Error;
  emailError?: () => Error | null;
} = {}): Senders & { rec: Recorded } {
  const rec: Recorded = { email: [], push: [], sms: [] };
  return {
    rec,
    email: {
      async send(m) {
        const e = opts.emailError?.();
        if (e) throw e;
        rec.email.push(m);
      },
    },
    push: {
      async send(target, payload) {
        const r = opts.pushResult?.(target.endpoint) ?? 'sent';
        if (r instanceof Error) throw r;
        if (r === 'sent') rec.push.push({ target, payload });
        return r;
      },
    },
    sms: {
      async send(m) {
        rec.sms.push(m);
      },
    },
  };
}

/**
 * One PGlite per test file (migrations are slow); wipe user-owned data between tests.
 * TRUNCATE users CASCADE clears every table that references users.
 */
let shared: Db | null = null;
export async function freshDb(): Promise<Db> {
  const { createTestDb } = await import('../helpers/db');
  const { setDb } = await import('@/models/db');
  const { sql } = await import('drizzle-orm');
  if (!shared) shared = await createTestDb();
  else {
    await shared.execute(sql`TRUNCATE users, recall_checks, market_snapshots, rate_limits CASCADE`);
    setDb(shared);
  }
  return shared;
}
