/**
 * SMS phone verification. Codes are 6 digits, stored only as
 * sha256(code + AUTH_SECRET), expire after config.smsCodeTtlMinutes, and allow
 * config.smsMaxAttempts guesses. Phone numbers never go into logs or errors.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { alertDeliveries, alerts, notificationSettings, smsVerifications } from '@/lib/db/schema';
import { notificationsConfig as cfg } from '@/config/notifications';
import { AppError, badRequest } from '@/lib/errors';
import type { SmsSender } from '@/lib/notify';
import { log } from '@/lib/log';
import { maskPhone } from './prefs';

/** US/NANP only: "(555) 555-0123", "555.555.0123", "+1 555 555 0123" -> "+15555550123". */
export function normalizeUsPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;
  let d = trimmed.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  else if (trimmed.startsWith('+')) return null; // non-US country code
  if (d.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return null;
  return `+1${d}`;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') {
    throw new AppError(503, 'not_configured', 'Phone verification is not configured on this server.');
  }
  return s ?? '';
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code + secret()).digest('hex');
}

export async function sendVerificationCode(
  db: Db,
  sms: SmsSender,
  args: { userId: string; phone: string; consentText: string; now?: Date },
): Promise<{ phone: { masked: string; verified: false }; expiresAt: string }> {
  const now = args.now ?? new Date();
  const e164 = normalizeUsPhone(args.phone);
  if (!e164) throw badRequest('Enter a valid US mobile number.', { phone: ['Enter a 10-digit US mobile number.'] });

  // Only the newest code is valid.
  await db
    .update(smsVerifications)
    .set({ consumedAt: now })
    .where(and(eq(smsVerifications.userId, args.userId), isNull(smsVerifications.consumedAt)));

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(now.getTime() + cfg.smsCodeTtlMinutes * 60_000);
  const [row] = await db
    .insert(smsVerifications)
    .values({ userId: args.userId, phoneE164: e164, codeHash: hashCode(code), consentText: args.consentText, expiresAt, createdAt: now })
    .returning({ id: smsVerifications.id });
  try {
    await sms.send({ to: e164, body: `Your AutoIQ verification code is ${code}. It expires in ${cfg.smsCodeTtlMinutes} minutes.` });
  } catch (err) {
    await db.delete(smsVerifications).where(eq(smsVerifications.id, row!.id));
    log.warn('phone.send_code_failed', { errCode: (err as { code?: unknown })?.code ?? 'unknown' });
    throw new AppError(502, 'upstream_failed', 'We could not send a text to that number. Check it and try again.');
  }
  return { phone: { masked: maskPhone(e164), verified: false }, expiresAt: expiresAt.toISOString() };
}

export async function verifyPhoneCode(
  db: Db,
  args: { userId: string; code: string; now?: Date },
): Promise<{ phone: { masked: string; verified: true } }> {
  const now = args.now ?? new Date();
  const [v] = await db
    .select()
    .from(smsVerifications)
    .where(and(eq(smsVerifications.userId, args.userId), isNull(smsVerifications.consumedAt)))
    .orderBy(desc(smsVerifications.createdAt))
    .limit(1);
  if (!v) throw badRequest('There is no active code. Request a new one.', { code: ['Request a new code.'] });
  if (v.expiresAt.getTime() <= now.getTime()) {
    throw badRequest('This code has expired. Request a new one.', { code: ['Code expired.'] });
  }
  if (v.attempts >= cfg.smsMaxAttempts) {
    throw new AppError(429, 'rate_limited', 'Too many wrong codes. Request a new one.');
  }
  const given = /^\d{6}$/.test(args.code.trim()) ? hashCode(args.code.trim()) : '';
  const ok = given.length === v.codeHash.length && timingSafeEqual(Buffer.from(given), Buffer.from(v.codeHash));
  if (!ok) {
    const attempts = v.attempts + 1;
    await db.update(smsVerifications).set({ attempts }).where(eq(smsVerifications.id, v.id));
    const left = Math.max(cfg.smsMaxAttempts - attempts, 0);
    if (left === 0) throw new AppError(429, 'rate_limited', 'Too many wrong codes. Request a new one.');
    throw badRequest(`That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`, { code: ['Wrong code.'] });
  }
  await db.update(smsVerifications).set({ consumedAt: now, attempts: v.attempts + 1 }).where(eq(smsVerifications.id, v.id));
  const set = { phoneE164: v.phoneE164, phoneVerifiedAt: now, smsConsentAt: now, smsConsentText: v.consentText, updatedAt: now };
  await db
    .insert(notificationSettings)
    .values({ userId: args.userId, ...set })
    .onConflictDoUpdate({ target: notificationSettings.userId, set });
  return { phone: { masked: maskPhone(v.phoneE164), verified: true } };
}

export async function removePhone(db: Db, userId: string) {
  await db
    .update(notificationSettings)
    .set({ phoneE164: null, phoneVerifiedAt: null, smsConsentAt: null, smsConsentText: null, updatedAt: new Date() })
    .where(eq(notificationSettings.userId, userId));
  // Queued texts must not go out after the number is removed.
  const mine = db.select({ id: alerts.id }).from(alerts).where(eq(alerts.userId, userId));
  await db
    .update(alertDeliveries)
    .set({ status: 'skipped' })
    .where(and(eq(alertDeliveries.channel, 'sms'), eq(alertDeliveries.status, 'pending'), inArray(alertDeliveries.alertId, mine)));
  return { phone: null };
}
