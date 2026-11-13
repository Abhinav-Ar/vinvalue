import { json, parse, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { badRequest } from '@/lib/errors';
import { todayFor } from '@/lib/garage/clock';
import { createFromAppraisalSchema, createFromVinSchema, createVehicleFromAppraisal, createVehicleFromVin, listGarage } from '@/lib/garage/vehicles';

/** GET /api/vehicles: the Garage page (vehicles + totals). */
export const GET = route<Record<string, string>, true>({ auth: true, name: 'vehicles.list' }, async ({ userId }) => {
  const db = getDb();
  return json(await listGarage(db, userId, await todayFor(db, userId)));
});

/** POST /api/vehicles: add by VIN ({vin, zip, odometer, ...}) or from a saved appraisal ({fromAppraisalId}). */
export const POST = route<Record<string, string>, true>({ auth: true, name: 'vehicles.create' }, async ({ req, userId }) => {
  const db = getDb();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
  const today = await todayFor(db, userId);
  const isFromAppraisal = !!body && typeof body === 'object' && 'fromAppraisalId' in body;
  const vehicle = isFromAppraisal
    ? await createVehicleFromAppraisal(db, userId, parse(createFromAppraisalSchema, body), today)
    : await createVehicleFromVin(db, getProviders(), userId, parse(createFromVinSchema, body), today);
  return json(vehicle, { status: 201 });
});
