import { eq } from 'drizzle-orm';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { vehicles } from '@/lib/db/schema';
import { requireVehicle } from '@/lib/ownership';
import { todayFor } from '@/lib/garage/clock';
import { deleteVehicleFiles } from '@/lib/garage/documents';
import { patchVehicleSchema, updateVehicle, vehicleDto } from '@/lib/garage/vehicles';

type P = { id: string };

export const GET = route<P, true>({ auth: true, name: 'vehicles.get' }, async ({ params, userId }) => {
  const db = getDb();
  return json(vehicleDto(await requireVehicle(db, userId, params.id), await todayFor(db, userId)));
});

/** PATCH: nickname, trim (recomputes modelKey), zip, odometer (records a reading), purchase fields. */
export const PATCH = route<P, true>({ auth: true, name: 'vehicles.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const patch = await parseJson(req, patchVehicleSchema);
  return json(await updateVehicle(db, v, patch, await todayFor(db, userId)));
});

export const DELETE = route<P, true>({ auth: true, name: 'vehicles.delete' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  await deleteVehicleFiles(db, v.id);
  await db.delete(vehicles).where(eq(vehicles.id, v.id));
  return new Response(null, { status: 204 });
});
