import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { verifyPhoneCode } from '@/lib/alerts/phone';

const Body = z.object({ code: z.string({ error: 'Enter the 6-digit code.' }).trim().max(12) });

/** POST /api/phone/verify { code } -> { phone: { masked, verified: true } } */
export const POST = route({ auth: true, name: 'phone.verify' }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  return json(await verifyPhoneCode(getDb(), { userId, code: b.code }));
});
