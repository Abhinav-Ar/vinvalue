import { z } from 'zod';
import { json, parseQuery, route } from '@/models/http';
import { getDb } from '@/models/db';
import { listHistory } from '@/models/history';

const Query = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(50), garageOnly: z.enum(['true', 'false']).optional() });
export const GET = route({ auth: true, name: 'history.collection' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  return json(await listHistory(getDb(), userId, { ...q, garageOnly: q.garageOnly === 'true' }), { headers: { 'Cache-Control': 'private, no-store' } });
});
