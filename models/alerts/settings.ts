import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { notificationPrefs, notificationSettings, users } from '@/models/db/schema';
import { ALERT_TYPES, CHANNELS, type EmailDigest, type PrefsMatrix } from '@/models/config/notifications';
import type { AlertType } from '@/shared/contracts';
import type { Channel } from '@/models/config/notifications';
import { badRequest, notFound } from '@/models/errors';
import { loadNotifyContext, maskPhone } from './prefs';

export type PrefsView = {
  matrix: PrefsMatrix;
  emailDigest: EmailDigest;
  quietStart: string | null;
  quietEnd: string | null;
  timeZone: string;
  phone: { masked: string; verified: boolean } | null;
};

export async function getPrefsView(db: Db, userId: string): Promise<PrefsView> {
  const ctx = await loadNotifyContext(db, userId);
  if (!ctx) throw notFound('User');
  const s = ctx.settings;
  return {
    matrix: ctx.matrix,
    emailDigest: ctx.emailDigest,
    quietStart: ctx.quietStart,
    quietEnd: ctx.quietEnd,
    timeZone: ctx.timeZone,
    phone: s?.phoneE164 ? { masked: maskPhone(s.phoneE164), verified: !!s.phoneVerifiedAt } : null,
  };
}

export type PrefsUpdate = {
  matrix?: Partial<Record<AlertType, Partial<Record<Channel, boolean>>>>;
  emailDigest?: EmailDigest;
  quietStart?: string | null;
  quietEnd?: string | null;
  timeZone?: string;
};

export async function updatePrefs(db: Db, userId: string, u: PrefsUpdate): Promise<PrefsView> {
  if (u.matrix?.recall?.in_app === false) {
    throw badRequest('In-app recall alerts cannot be turned off.', { 'matrix.recall.in_app': ['In-app recall alerts are always on.'] });
  }
  const current = await getPrefsView(db, userId);
  const qs = u.quietStart !== undefined ? u.quietStart : current.quietStart;
  const qe = u.quietEnd !== undefined ? u.quietEnd : current.quietEnd;
  if ((qs === null) !== (qe === null)) {
    throw badRequest('Set both quiet hours times, or clear both.', { quietStart: ['Set both times or neither.'], quietEnd: ['Set both times or neither.'] });
  }

  const rows: (typeof notificationPrefs.$inferInsert)[] = [];
  for (const t of ALERT_TYPES) {
    const r = u.matrix?.[t];
    if (!r) continue;
    for (const c of CHANNELS) if (typeof r[c] === 'boolean') rows.push({ userId, alertType: t, channel: c, enabled: r[c]! });
  }
  for (const row of rows) {
    await db
      .insert(notificationPrefs)
      .values(row)
      .onConflictDoUpdate({
        target: [notificationPrefs.userId, notificationPrefs.alertType, notificationPrefs.channel],
        set: { enabled: row.enabled },
      });
  }

  const set: Partial<typeof notificationSettings.$inferInsert> = {};
  if (u.emailDigest !== undefined) set.emailDigest = u.emailDigest;
  if (u.quietStart !== undefined) set.quietStart = u.quietStart;
  if (u.quietEnd !== undefined) set.quietEnd = u.quietEnd;
  if (Object.keys(set).length) {
    await db
      .insert(notificationSettings)
      .values({ userId, ...set })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: { ...set, updatedAt: new Date() } });
  }
  if (u.timeZone !== undefined) await db.update(users).set({ timeZone: u.timeZone }).where(eq(users.id, userId));
  return getPrefsView(db, userId);
}
