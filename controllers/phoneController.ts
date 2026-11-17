import { json, route, parseJson } from '@/models/http';
import { getDb } from '@/models/db';
import { removePhone, sendVerificationCode, verifyPhoneCode } from '@/models/alerts/phone';
import { z } from 'zod';
import { RULES } from '@/models/ratelimit';
import { getSenders } from '@/models/notify';
/** DELETE /api/phone -> { phone: null }. Removes the number and consent; SMS stops. */
export const deletePhone = route({ auth: true, name: 'phone.delete' }, async ({ userId }) => json(await removePhone(getDb(), userId)));
const SendCodeBody = z.object({
  phone: z.string({ error: 'Enter a mobile number.' }).min(7).max(32),
  consent: z.literal(true, { error: 'Agree to receive texts to continue.' }),
  consentText: z.string().trim().min(10, 'Consent wording is required.').max(1000),
});

/** POST /api/phone/send-code { phone, consent: true, consentText } -> 202 { phone: { masked, verified: false }, expiresAt } */
export const sendPhoneCode = route({ auth: true, name: 'phone.sendCode', rateLimit: RULES.smsSend }, async ({ req, userId }) => {
  const b = await parseJson(req, SendCodeBody);
  const r = await sendVerificationCode(getDb(), getSenders().sms, { userId, phone: b.phone, consentText: b.consentText });
  return json(r, { status: 202 });
});
const VerifyBody = z.object({ code: z.string({ error: 'Enter the 6-digit code.' }).trim().max(12) });

/** POST /api/phone/verify { code } -> { phone: { masked, verified: true } } */
export const verifyPhone = route({ auth: true, name: 'phone.verify' }, async ({ req, userId }) => {
  const b = await parseJson(req, VerifyBody);
  return json(await verifyPhoneCode(getDb(), { userId, code: b.code }));
});
