import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { markAllRead } from '@/lib/alerts/list';

/** POST /api/alerts/read-all -> { updated }. */
export const POST = route({ auth: true, name: 'alerts.readAll' }, async ({ userId }) => {
  return json(await markAllRead(getDb(), userId));
});
