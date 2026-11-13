import { inArray } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { notificationPrefs, notificationSettings, users } from '@/lib/db/schema';
import {
  ALERT_TYPES, CHANNELS, DEFAULT_EMAIL_DIGEST, DEFAULT_PREFS, type EmailDigest, type PrefsMatrix,
} from '@/config/notifications';

export type NotificationSettingsRow = typeof notificationSettings.$inferSelect;

export type UserNotifyContext = {
  userId: string;
  matrix: PrefsMatrix;
  emailDigest: EmailDigest;
  quietStart: string | null;
  quietEnd: string | null;
  timeZone: string;
  hasEmail: boolean;
  /** True only when phone verified AND consent recorded. */
  smsReady: boolean;
  settings: NotificationSettingsRow | null;
};

export function cloneDefaults(): PrefsMatrix {
  const m = {} as PrefsMatrix;
  for (const t of ALERT_TYPES) m[t] = { ...DEFAULT_PREFS[t] };
  return m;
}

export function smsReady(s: Pick<NotificationSettingsRow, 'phoneE164' | 'phoneVerifiedAt' | 'smsConsentAt'> | null | undefined): boolean {
  return !!(s?.phoneE164 && s.phoneVerifiedAt && s.smsConsentAt);
}

/** Load prefs/settings for many users at once (defaults when no rows exist). */
export async function loadNotifyContexts(db: Db, userIds: string[]): Promise<Map<string, UserNotifyContext>> {
  const out = new Map<string, UserNotifyContext>();
  if (!userIds.length) return out;
  const [us, ps, ss] = await Promise.all([
    db.select({ id: users.id, email: users.email, timeZone: users.timeZone }).from(users).where(inArray(users.id, userIds)),
    db.select().from(notificationPrefs).where(inArray(notificationPrefs.userId, userIds)),
    db.select().from(notificationSettings).where(inArray(notificationSettings.userId, userIds)),
  ]);
  for (const u of us) {
    const s = ss.find((x) => x.userId === u.id) ?? null;
    const matrix = cloneDefaults();
    for (const p of ps) if (p.userId === u.id) matrix[p.alertType][p.channel] = p.enabled;
    matrix.recall.in_app = true; // never disabled
    out.set(u.id, {
      userId: u.id,
      matrix,
      emailDigest: s?.emailDigest ?? DEFAULT_EMAIL_DIGEST,
      quietStart: s?.quietStart ?? null,
      quietEnd: s?.quietEnd ?? null,
      timeZone: u.timeZone,
      hasEmail: !!u.email,
      smsReady: smsReady(s),
      settings: s,
    });
  }
  return out;
}

export async function loadNotifyContext(db: Db, userId: string): Promise<UserNotifyContext | null> {
  return (await loadNotifyContexts(db, [userId])).get(userId) ?? null;
}

/** "+15555550123" -> "(***) ***-0123". */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  return `(***) ***-${digits.slice(-4)}`;
}

export async function ensureSettingsRow(db: Db, userId: string) {
  await db.insert(notificationSettings).values({ userId }).onConflictDoNothing({ target: notificationSettings.userId });
}

export { CHANNELS, ALERT_TYPES };
