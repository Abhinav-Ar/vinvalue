import { eq } from 'drizzle-orm';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { serviceEvents } from '@/lib/db/schema';
import { todayFor } from '@/lib/garage/clock';
import { eventDto, patchEventSchema, requireEvent, updateEvent } from '@/lib/garage/services';

type P = { id: string };

export const GET = route<P, true>({ auth: true, name: 'service_events.get' }, async ({ params, userId }) => {
  const db = getDb();
  return json(eventDto(await requireEvent(db, userId, params.id), await todayFor(db, userId)));
});

/** PATCH: complete ({status:'done', odometer, costCents, shop, receiptDocumentId}), reschedule ({date}), or edit. */
export const PATCH = route<P, true>({ auth: true, name: 'service_events.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const e = await requireEvent(db, userId, params.id);
  return json(await updateEvent(db, e, await parseJson(req, patchEventSchema), await todayFor(db, userId)));
});

export const DELETE = route<P, true>({ auth: true, name: 'service_events.delete' }, async ({ params, userId }) => {
  const db = getDb();
  const e = await requireEvent(db, userId, params.id);
  await db.delete(serviceEvents).where(eq(serviceEvents.id, e.id));
  return new Response(null, { status: 204 });
});
