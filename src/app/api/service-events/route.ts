import { z } from 'zod';
import { json, parseJson, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { badRequest } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { idSchema, isoDateSchema } from '@/lib/validation';
import { todayFor } from '@/lib/garage/clock';
import { diffDays } from '@/lib/garage/dates';
import { calendar, createEvent, createEventSchema } from '@/lib/garage/services';

const rangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema, vehicleId: idSchema.optional() });

/** GET ?from&to[&vehicleId]: calendar items (service events + document renewals) in range. */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'service_events.calendar' }, async ({ req, userId }) => {
  const db = getDb();
  const q = parseQuery(req, rangeSchema);
  if (q.to < q.from) throw badRequest('"to" must be on or after "from".', { to: ['Before from.'] });
  if (diffDays(q.from, q.to) > 400) throw badRequest('Ask for at most about a year at a time.', { to: ['Range too long.'] });
  if (q.vehicleId) await requireVehicle(db, userId, q.vehicleId);
  const items = await calendar(db, userId, q, await todayFor(db, userId));
  return json({ from: q.from, to: q.to, items });
});

/** POST: schedule a service, or log a done one (done + odometer records a reading). */
export const POST = route<Record<string, string>, true>({ auth: true, name: 'service_events.create' }, async ({ req, userId }) => {
  const db = getDb();
  const body = await parseJson(req, createEventSchema);
  await requireVehicle(db, userId, body.vehicleId);
  return json(await createEvent(db, body, await todayFor(db, userId)), { status: 201 });
});
