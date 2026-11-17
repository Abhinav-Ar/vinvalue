import { z } from 'zod';
import { json, parseQuery, route } from '@/models/http';
import { getDb } from '@/models/db';
import { listAlerts as listAlertsModel, markRead, markAllRead } from '@/models/alerts/list';
const Query = z.object({
  filter: z.enum(['all', 'unread', 'recall', 'maintenance', 'value', 'price_target', 'renewal', 'market']).default('all'),
  cursor: z.string().max(200).optional(),
});

/** GET /api/alerts?filter=&cursor= -> { items, unreadCount, nextCursor } (newest first). */
export const listAlerts = route({ auth: true, name: 'alerts.list' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  return json(await listAlertsModel(getDb(), userId, q.filter, q.cursor));
});
/** PATCH /api/alerts/:id/read -> { id, read: true }. 404 for alerts that are not the caller's. */
export const markAlertRead = route<{ id: string }, true>({ auth: true, name: 'alerts.read' }, async ({ params, userId }) => {
  return json(await markRead(getDb(), userId, params.id));
});
/** POST /api/alerts/read-all -> { updated }. */
export const markAllAlertsRead = route({ auth: true, name: 'alerts.readAll' }, async ({ userId }) => {
  return json(await markAllRead(getDb(), userId));
});
