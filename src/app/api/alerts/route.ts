import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { listAlerts } from '@/lib/alerts/list';

const Query = z.object({
  filter: z.enum(['all', 'unread', 'recall', 'maintenance', 'value', 'price_target', 'renewal', 'market']).default('all'),
  cursor: z.string().max(200).optional(),
});

/** GET /api/alerts?filter=&cursor= -> { items, unreadCount, nextCursor } (newest first). */
export const GET = route({ auth: true, name: 'alerts.list' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  return json(await listAlerts(getDb(), userId, q.filter, q.cursor));
});
