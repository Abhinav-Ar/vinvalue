import { z } from 'zod';
import { json, parseJson, route } from '@/models/http';
import { getDb } from '@/models/db';
import { getPrefsView, updatePrefs } from '@/models/alerts/settings';
import { HHMM_RE, isValidTimeZone } from '@/models/alerts/quiet';
const Cells = z
  .object({ in_app: z.boolean(), email: z.boolean(), push: z.boolean(), sms: z.boolean() })
  .partial()
  .strict();
const time = z.string().regex(HHMM_RE, 'Use HH:MM (24-hour).').nullable();

const Body = z
  .object({
    matrix: z
      .object({ recall: Cells, maintenance: Cells, value: Cells, price_target: Cells, renewal: Cells, market: Cells })
      .partial()
      .strict()
      .optional(),
    emailDigest: z.enum(['instant', 'recalls_instant_rest_weekly', 'weekly']).optional(),
    quietStart: time.optional(),
    quietEnd: time.optional(),
    timeZone: z.string().max(64).refine(isValidTimeZone, 'Use an IANA time zone such as America/Chicago.').optional(),
  })
  .strict();

/** GET /api/notification-prefs -> { matrix, emailDigest, quietStart, quietEnd, timeZone, phone } */
export const getNotificationPrefs = route({ auth: true, name: 'prefs.get' }, async ({ userId }) => json(await getPrefsView(getDb(), userId)));

/** PUT /api/notification-prefs (any subset of the GET fields except phone) -> same shape as GET. */
export const updateNotificationPrefs = route({ auth: true, name: 'prefs.put' }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  return json(await updatePrefs(getDb(), userId, b));
});
