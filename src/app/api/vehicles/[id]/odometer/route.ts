import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { odometerReadings } from '@/lib/db/schema';
import { badRequest } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { isoDateSchema, mileageSchema } from '@/lib/validation';
import { todayFor } from '@/lib/garage/clock';
import { milesPerMonth, recordOdometer } from '@/lib/garage/maintenance';

type P = { id: string };
const bodySchema = z.object({ miles: mileageSchema, on: isoDateSchema });

/** GET: readings oldest first plus the miles/month estimate. */
export const GET = route<P, true>({ auth: true, name: 'vehicles.odometer.list' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const readings = await db
    .select({ id: odometerReadings.id, miles: odometerReadings.miles, on: odometerReadings.recordedOn, source: odometerReadings.source })
    .from(odometerReadings)
    .where(eq(odometerReadings.vehicleId, v.id))
    .orderBy(asc(odometerReadings.recordedOn), asc(odometerReadings.miles));
  return json({ readings, milesPerMonth: await milesPerMonth(db, v.id) });
});

/** POST {miles, on}: 400 if the reading goes backwards or is dated in the future. */
export const POST = route<P, true>({ auth: true, name: 'vehicles.odometer.add' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const body = await parseJson(req, bodySchema);
  if (body.on > (await todayFor(db, userId))) throw badRequest('Readings cannot be dated in the future.', { on: ['Date is in the future.'] });
  await recordOdometer(db, v.id, body.miles, body.on, 'manual');
  const updated = await requireVehicle(db, userId, v.id);
  return json({ odometer: updated.odometer, milesPerMonth: await milesPerMonth(db, v.id) }, { status: 201 });
});
