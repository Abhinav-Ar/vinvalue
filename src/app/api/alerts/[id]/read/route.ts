import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { markRead } from '@/lib/alerts/list';

/** PATCH /api/alerts/:id/read -> { id, read: true }. 404 for alerts that are not the caller's. */
export const PATCH = route<{ id: string }, true>({ auth: true, name: 'alerts.read' }, async ({ params, userId }) => {
  return json(await markRead(getDb(), userId, params.id));
});
