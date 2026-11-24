import { ensureFeedback } from '@/models/appraisals/feedback';
import { z } from 'zod';
import { json, parse, route, parseJson, parseQuery } from '@/models/http';
import { getDb } from '@/models/db';
import { documentKindEnum, odometerReadings, vehicles } from '@/models/db/schema';
import { badRequest } from '@/models/errors';
import { requireVehicle } from '@/models/ownership';
import { isoDateSchema, mileageSchema, dollarsSchema } from '@/models/validation';
import { createDocument, listDocuments, deleteVehicleFiles } from '@/models/garage/documents';
import { asc, eq } from 'drizzle-orm';
import { todayFor } from '@/models/garage/clock';
import { milesPerMonth, recordOdometer } from '@/models/garage/maintenance';
import { vehicleOverview, patchVehicleSchema, updateVehicle as updateVehicleModel, vehicleDto, createFromAppraisalSchema, createFromVinSchema, createVehicleFromAppraisal, createVehicleFromVin, listGarage } from '@/models/garage/vehicles';
import { getProviders } from '@/models/providers';
import { RULES } from '@/models/ratelimit';
import { refreshVehicleValue as refreshVehicleValueModel } from '@/models/appraisals';
import { getValueTracker } from '@/models/forecast/service';
import { isoToday } from '@/models/market/service';
import { forecastConfig } from '@/models/config/forecast';
import { getSellPlan as getSellPlanModel } from '@/models/sell/service';
type P = { id: string };

const metaSchema = z.object({
  kind: z.enum(documentKindEnum.enumValues, { error: 'Pick a document type.' }),
  label: z.string().trim().max(120).nullable().optional(),
  expiresOn: isoDateSchema.nullable().optional(),
});

export const listVehicleDocuments = route<P, true>({ auth: true, name: 'documents.list' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  return json({ documents: await listDocuments(db, v.id) });
});

/**
 * POST multipart/form-data: file (optional, up to 10 MB, pdf/jpeg/png/heic/webp), kind, label, expiresOn.
 * Also accepts JSON {kind, label, expiresOn} for metadata-only records (e.g. "Registration renews Dec 22").
 */
export const createVehicleDocument = route<P, true>({ auth: true, name: 'documents.create' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest('Could not read the upload.');
    }
    const str = (k: string) => {
      const x = form.get(k);
      return typeof x === 'string' && x.trim() !== '' ? x : null;
    };
    const meta = parse(metaSchema, { kind: str('kind') ?? undefined, label: str('label'), expiresOn: str('expiresOn') });
    const f = form.get('file');
    const file = f && typeof f !== 'string' ? { body: f as Blob, contentType: f.type, size: f.size } : null;
    return json(await createDocument(db, v.id, { kind: meta.kind, label: meta.label ?? null, expiresOn: meta.expiresOn ?? null, file }), { status: 201 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Send multipart/form-data with a file, or JSON for a record without a file.');
  }
  const meta = parse(metaSchema, body);
  return json(await createDocument(db, v.id, { kind: meta.kind, label: meta.label ?? null, expiresOn: meta.expiresOn ?? null }), { status: 201 });
});
const bodySchema = z.object({ miles: mileageSchema, on: isoDateSchema });

/** GET: readings oldest first plus the miles/month estimate. */
export const listOdometer = route<P, true>({ auth: true, name: 'vehicles.odometer.list' }, async ({ params, userId }) => {
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
export const addOdometer = route<P, true>({ auth: true, name: 'vehicles.odometer.add' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const body = await parseJson(req, bodySchema);
  if (body.on > (await todayFor(db, userId))) throw badRequest('Readings cannot be dated in the future.', { on: ['Date is in the future.'] });
  await recordOdometer(db, v.id, body.miles, body.on, 'manual');
  const updated = await requireVehicle(db, userId, v.id);
  return json({ odometer: updated.odometer, milesPerMonth: await milesPerMonth(db, v.id) }, { status: 201 });
});
/** GET /api/vehicles/[id]/overview: the Vehicle page. */
export const getVehicleOverview = route<{ id: string }, true>({ auth: true, name: 'vehicles.overview' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  return json(await vehicleOverview(db, v, await todayFor(db, userId)));
});
/** POST /api/vehicles/[id]/refresh-value: re-appraise a garage vehicle with its saved answers. */
export const refreshVehicleValue = route<{ id: string }, true>({ auth: true, name: 'vehicles.refresh_value', rateLimit: RULES.appraise }, async ({ params, userId }) => {
  const db = getDb();
  await requireVehicle(db, userId, params.id);
  return json(await refreshVehicleValueModel(db, getProviders(), params.id), { status: 201 });
});

export const getVehicle = route<P, true>({ auth: true, name: 'vehicles.get' }, async ({ params, userId }) => {
  const db = getDb();
  return json(vehicleDto(await requireVehicle(db, userId, params.id), await todayFor(db, userId)));
});

/** PATCH: nickname, trim (recomputes modelKey), zip, odometer (records a reading), purchase fields. */
export const updateVehicle = route<P, true>({ auth: true, name: 'vehicles.update' }, async ({ req, params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  const patch = await parseJson(req, patchVehicleSchema);
  return json(await updateVehicleModel(db, v, patch, await todayFor(db, userId)));
});

export const deleteVehicle = route<P, true>({ auth: true, name: 'vehicles.delete' }, async ({ params, userId }) => {
  const db = getDb();
  const v = await requireVehicle(db, userId, params.id);
  await ensureFeedback(db, userId, v.id, 'removed');
  await deleteVehicleFiles(db, v.id);
  await db.delete(vehicles).where(eq(vehicles.id, v.id));
  return new Response(null, { status: 204 });
});
const Query = z.object({
  milesPerYear: z.coerce
    .number({ error: 'Miles per year must be a number.' })
    .int('Use whole miles.')
    .min(0, 'Miles per year cannot be negative.')
    .max(forecastConfig.maxMilesPerYear, `Miles per year must be ${forecastConfig.maxMilesPerYear.toLocaleString('en-US')} or less.`)
    .optional(),
});

/** GET /api/vehicles/[id]/value?milesPerYear=: appraisal history + 12-month forecast. */
export const getVehicleValue = route<{ id: string }, true>({ auth: true, name: 'vehicles.value' }, async ({ req, params, userId }) => {
  const q = parseQuery(req, Query);
  return json(await getValueTracker(getDb(), userId, params.id, { milesPerYear: q.milesPerYear, today: isoToday() }));
});
const Body = z.object({
  loanPayoff: dollarsSchema().default(0),
  askingPrice: dollarsSchema().optional(),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a 2-letter state code.').optional(),
});

/** POST /api/vehicles/[id]/sell-plan: instant vs trade-in vs private, with state checklist and listing kit. */
export const getSellPlan = route<{ id: string }, true>({ auth: true, name: 'vehicles.sell_plan' }, async ({ req, params, userId }) => {
  const b = await parseJson(req, Body);
  return json(await getSellPlanModel(getDb(), userId, params.id, b, isoToday()));
});
/** GET /api/vehicles: the Garage page (vehicles + totals). */
export const listVehicles = route<Record<string, string>, true>({ auth: true, name: 'vehicles.list' }, async ({ userId }) => {
  const db = getDb();
  return json(await listGarage(db, userId, await todayFor(db, userId)));
});

/** POST /api/vehicles: add by VIN ({vin, zip, odometer, ...}) or from a saved appraisal ({fromAppraisalId}). */
export const createVehicle = route<Record<string, string>, true>({ auth: true, name: 'vehicles.create' }, async ({ req, userId }) => {
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
