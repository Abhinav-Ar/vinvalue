import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { requireVehicle } from '@/lib/ownership';
import { idSchema } from '@/lib/validation';
import { todayFor } from '@/lib/garage/clock';
import { upcomingMaintenance } from '@/lib/garage/maintenance';

const q = z.object({ vehicleId: idSchema.optional(), limit: z.coerce.number().int().min(1).max(200).optional() });

/** GET ?vehicleId&limit: date items ("3 days overdue" / "today" / "in 6 days") and mileage items, most urgent first. */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'maintenance.upcoming' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, q);
  if (query.vehicleId) await requireVehicle(db, userId, query.vehicleId);
  const today = await todayFor(db, userId);
  const items = await upcomingMaintenance(db, userId, today, query);
  return json({
    today,
    items,
    dueNext: items.filter((i) => i.kind === 'date'),
    byMileage: items.filter((i) => i.kind === 'mileage'),
  });
});
