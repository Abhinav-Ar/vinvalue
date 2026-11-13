import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { compareBuyChecks } from '@/lib/buy/service';

const Query = z.object({ ids: z.string({ error: 'Pass ids=a,b,c.' }).min(1) });

/** GET /api/buy-checks/compare?ids=a,b,c (max 3) */
export const GET = route({ auth: true, name: 'buy_checks.compare' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  const ids = q.ids.split(',').map((s) => s.trim()).filter(Boolean);
  return json({ rows: await compareBuyChecks(getDb(), userId!, ids) });
});
