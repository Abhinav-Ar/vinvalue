import { z } from 'zod';
import { json, parseJson, parseQuery, route } from '@/models/http';
import { getDb } from '@/models/db';
import { badRequest } from '@/models/errors';
import { requireVehicle } from '@/models/ownership';
import { idSchema } from '@/models/validation';
import { effectiveIntervals, setVehicleIntervals, upcomingMaintenance } from '@/models/garage/maintenance';
import { serviceTypeSchema, logToCsv, serviceLog, spend } from '@/models/garage/services';
import { todayFor } from '@/models/garage/clock';
const VehicleQuery = z.object({ vehicleId: idSchema });
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
export const getIntervals = route<Record<string, string>, true>({ auth: true, name: 'maintenance.intervals.get' }, async ({ req, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, parseQuery(req, VehicleQuery).vehicleId);
  return json({ vehicleId: v.id, intervals: await effectiveIntervals(db, v) });
});

/** PUT ?vehicleId {intervals:[{type,title,everyMiles?,everyMonths?}]}: replaces this vehicle's own overrides. */
export const updateIntervals = route<Record<string, string>, true>({ auth: true, name: 'maintenance.intervals.put' }, async ({ req, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, parseQuery(req, VehicleQuery).vehicleId);
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
const ServiceLogQuery = z.object({
  vehicleId: idSchema.optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  format: z.enum(['json', 'csv']).optional(),
});

/** GET ?year[&vehicleId][&format=csv]: completed services, newest first. */
export const getServiceLog = route<Record<string, string>, true>({ auth: true, name: 'maintenance.log' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, ServiceLogQuery);
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
const SpendQuery = z.object({ year: z.coerce.number().int().min(1900).max(2200).optional() });

/** GET ?year: service spend per vehicle and in total, in integer cents. */
export const getServiceSpend = route<Record<string, string>, true>({ auth: true, name: 'maintenance.spend' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, SpendQuery);
  const year = query.year ?? Number((await todayFor(db, userId)).slice(0, 4));
  return json(await spend(db, userId, year));
});
const UpcomingQuery = z.object({ vehicleId: idSchema.optional(), limit: z.coerce.number().int().min(1).max(200).optional() });

/** GET ?vehicleId&limit: date items ("3 days overdue" / "today" / "in 6 days") and mileage items, most urgent first. */
export const getUpcomingMaintenance = route<Record<string, string>, true>({ auth: true, name: 'maintenance.upcoming' }, async ({ req, userId }) => {
  const db = getDb();
  const query = parseQuery(req, UpcomingQuery);
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
