import { z } from 'zod';
import { getDb } from '@/models/db';
import { json, parseJson, route } from '@/models/http';
import { dismissFeedback, ensureFeedback, listFeedback } from '@/models/appraisals/feedback';
export const listSaleFeedback = route({ auth: true, name: 'saleFeedback.list' }, async ({ userId }) => json({ items: await listFeedback(getDb(), userId) }));
export const createSaleFeedback = route<{ id: string }, true>({ auth: true, name: 'saleFeedback.create' }, async ({ req, params, userId }) => {
  const { reason } = await parseJson(req, z.object({ reason: z.enum(['sold', 'planned']) }));
  return json(await ensureFeedback(getDb(), userId, params.id, reason));
});
export const dismissSaleFeedback = route<{ id: string }, true>({ auth: true, name: 'saleFeedback.dismiss' }, async ({ params, userId }) => {
  await dismissFeedback(getDb(), userId, params.id);
  return json({ ok: true });
});
