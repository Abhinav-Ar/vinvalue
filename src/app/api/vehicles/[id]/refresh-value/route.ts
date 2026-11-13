import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { RULES } from '@/lib/ratelimit';
import { requireVehicle } from '@/lib/ownership';
import { refreshVehicleValue } from '@/lib/appraisals';

/** POST /api/vehicles/[id]/refresh-value: re-appraise a garage vehicle with its saved answers. */
export const POST = route<{ id: string }, true>({ auth: true, name: 'vehicles.refresh_value', rateLimit: RULES.appraise }, async ({ params, userId }) => {
  const db = getDb();
  await requireVehicle(db, userId, params.id);
  return json(await refreshVehicleValue(db, getProviders(), params.id), { status: 201 });
});
