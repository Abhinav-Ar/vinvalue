import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { requireVehicle } from '@/lib/ownership';
import { idSchema } from '@/lib/validation';
import { todayFor } from '@/lib/garage/clock';
import { logToCsv, serviceLog } from '@/lib/garage/services';

const q = z.object({
  vehicleId: idSchema.optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

/** GET ?year[&vehicleId][&format=csv]: completed services, newest first. */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'maintenance.log' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, q);
  if (query.vehicleId) await requireVehicle(db, userId, query.vehicleId);
  const year = query.year ?? Number((await todayFor(db, userId)).slice(0, 4));
  const rows = await serviceLog(db, userId, { year, vehicleId: query.vehicleId });
  if (query.format === 'csv') {
    return new Response(logToCsv(rows, new URL(req.url).origin), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="autoiq-service-log-${year}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }
  return json({ year, items: rows });
});
