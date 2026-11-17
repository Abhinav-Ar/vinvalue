import { eq } from 'drizzle-orm';
import { json, parseJson, route, parseQuery } from '@/models/http';
import { getDb } from '@/models/db';
import { serviceEvents } from '@/models/db/schema';
import { todayFor } from '@/models/garage/clock';
import { eventDto, patchEventSchema, requireEvent, updateEvent, calendar, createEvent, createEventSchema } from '@/models/garage/services';
import { z } from 'zod';
import { badRequest } from '@/models/errors';
import { requireVehicle } from '@/models/ownership';
import { idSchema, isoDateSchema } from '@/models/validation';
import { diffDays } from '@/models/garage/dates';
type P = { id: string };

export const getServiceEvent = route<P, true>({ auth: true, name: 'service_events.get' }, async ({ params, userId }) => {
  const db = getDb();
  return json(eventDto(await requireEvent(db, userId, params.id), await todayFor(db, userId)));
});

/** PATCH: complete ({status:'done', odometer, costCents, shop, receiptDocumentId}), reschedule ({date}), or edit. */
export const updateServiceEvent = route<P, true>({ auth: true, name: 'service_events.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const e = await requireEvent(db, userId, params.id);
  return json(await updateEvent(db, e, await parseJson(req, patchEventSchema), await todayFor(db, userId)));
});

export const deleteServiceEvent = route<P, true>({ auth: true, name: 'service_events.delete' }, async ({ params, userId }) => {
  const db = getDb();
  const e = await requireEvent(db, userId, params.id);
  await db.delete(serviceEvents).where(eq(serviceEvents.id, e.id));
  return new Response(null, { status: 204 });
});
const rangeSchema = z.object({ from: isoDateSchema, to: isoDateSchema, vehicleId: idSchema.optional() });

/** GET ?from&to[&vehicleId]: calendar items (service events + document renewals) in range. */
export const listServiceEvents = route<Record<string, string>, true>({ auth: true, name: 'service_events.calendar' }, async ({ req, userId }) => {
  const db = getDb();
  const q = parseQuery(req, rangeSchema);
  if (q.to < q.from) throw badRequest('"to" must be on or after "from".', { to: ['Before from.'] });
  if (diffDays(q.from, q.to) > 400) throw badRequest('Ask for at most about a year at a time.', { to: ['Range too long.'] });
  if (q.vehicleId) await requireVehicle(db, userId, q.vehicleId);
  const items = await calendar(db, userId, q, await todayFor(db, userId));
  return json({ from: q.from, to: q.to, items });
});

/** POST: schedule a service, or log a done one (done + odometer records a reading). */
export const createServiceEvent = route<Record<string, string>, true>({ auth: true, name: 'service_events.create' }, async ({ req, userId }) => {
  const db = getDb();
  const body = await parseJson(req, createEventSchema);
  await requireVehicle(db, userId, body.vehicleId);
  return json(await createEvent(db, body, await todayFor(db, userId)), { status: 201 });
});
