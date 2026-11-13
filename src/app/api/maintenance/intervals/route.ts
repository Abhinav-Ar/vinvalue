import { z } from 'zod';
import { json, parseJson, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { badRequest } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { idSchema } from '@/lib/validation';
import { effectiveIntervals, setVehicleIntervals } from '@/lib/garage/maintenance';
import { serviceTypeSchema } from '@/lib/garage/services';

const q = z.object({ vehicleId: idSchema });
const putSchema = z.object({
  intervals: z
    .array(z.object({
      type: serviceTypeSchema,
      title: z.string().trim().min(1).max(120),
      everyMiles: z.number().int().min(100).max(500_000).nullable().optional(),
      everyMonths: z.number().int().min(1).max(240).nullable().optional(),
    }))
    .max(50),
});

/** GET ?vehicleId: effective intervals (vehicle rows over model rows over defaults). */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'maintenance.intervals.get' }, async ({ req, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, parseQuery(req, q).vehicleId);
  return json({ vehicleId: v.id, intervals: await effectiveIntervals(db, v) });
});

/** PUT ?vehicleId {intervals:[{type,title,everyMiles?,everyMonths?}]}: replaces this vehicle's own overrides. */
export const PUT = route<Record<string, string>, true>({ auth: true, name: 'maintenance.intervals.put' }, async ({ req, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, parseQuery(req, q).vehicleId);
  const body = await parseJson(req, putSchema);
  const types = new Set<string>();
  for (const [i, iv] of body.intervals.entries()) {
    if (!iv.everyMiles && !iv.everyMonths) throw badRequest('Each interval needs miles, months, or both.', { [`intervals.${i}`]: ['Set everyMiles or everyMonths.'] });
    if (types.has(iv.type)) throw badRequest('Each service type can appear once.', { [`intervals.${i}.type`]: ['Duplicate type.'] });
    types.add(iv.type);
  }
  await setVehicleIntervals(db, v.id, body.intervals.map((i) => ({ type: i.type, title: i.title, everyMiles: i.everyMiles ?? null, everyMonths: i.everyMonths ?? null })));
  return json({ vehicleId: v.id, intervals: await effectiveIntervals(db, v) });
});
