import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { todayFor } from '@/lib/garage/clock';
import { spend } from '@/lib/garage/services';

const q = z.object({ year: z.coerce.number().int().min(1900).max(2200).optional() });

/** GET ?year: service spend per vehicle and in total, in integer cents. */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'maintenance.spend' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, q);
  const year = query.year ?? Number((await todayFor(db, userId)).slice(0, 4));
  return json(await spend(db, userId, year));
});
