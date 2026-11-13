import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { RULES } from '@/lib/ratelimit';
import { getSenders } from '@/lib/notify';
import { sendVerificationCode } from '@/lib/alerts/phone';

const Body = z.object({
  phone: z.string({ error: 'Enter a mobile number.' }).min(7).max(32),
  consent: z.literal(true, { error: 'Agree to receive texts to continue.' }),
  consentText: z.string().trim().min(10, 'Consent wording is required.').max(1000),
});

/** POST /api/phone/send-code { phone, consent: true, consentText } -> 202 { phone: { masked, verified: false }, expiresAt } */
export const POST = route({ auth: true, name: 'phone.sendCode', rateLimit: RULES.smsSend }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  const r = await sendVerificationCode(getDb(), getSenders().sms, { userId, phone: b.phone, consentText: b.consentText });
  return json(r, { status: 202 });
});
