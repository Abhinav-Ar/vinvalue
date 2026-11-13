import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { requireVehicle } from '@/lib/ownership';
import { todayFor } from '@/lib/garage/clock';
import { vehicleOverview } from '@/lib/garage/vehicles';

/** GET /api/vehicles/[id]/overview: the Vehicle page. */
export const GET = route<{ id: string }, true>({ auth: true, name: 'vehicles.overview' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  return json(await vehicleOverview(db, v, await todayFor(db, userId)));
});
