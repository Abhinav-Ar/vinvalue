import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';

const Body = z.object({
  endpoint: z
    .string()
    .url('Invalid push endpoint.')
    .max(2048)
    .refine((u) => u.startsWith('https://'), 'Push endpoints must use https.'),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
});

/** POST /api/push-subscriptions { endpoint, keys: { p256dh, auth } } -> 201 { ok: true }. Re-subscribing moves the endpoint to the caller. */
export const POST = route({ auth: true, name: 'push.subscribe' }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  await getDb()
    .insert(pushSubscriptions)
    .values({ userId, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: b.keys.p256dh, auth: b.keys.auth } });
  return json({ ok: true }, { status: 201 });
});

/** DELETE /api/push-subscriptions { endpoint } -> { removed: 0 or 1 }. Only the caller's own subscription. */
export const DELETE = route({ auth: true, name: 'push.unsubscribe' }, async ({ req, userId }) => {
  const b = await parseJson(req, z.object({ endpoint: z.string().max(2048) }));
  const rows = await getDb()
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, b.endpoint), eq(pushSubscriptions.userId, userId)))
    .returning({ id: pushSubscriptions.id });
  return json({ removed: rows.length });
});
