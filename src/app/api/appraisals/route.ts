import { z } from 'zod';
import { json, parseJson, parseQuery, route } from '@/lib/http';
import { RULES } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { idSchema, mileageSchema, vinSchema, zipSchema } from '@/lib/validation';
import { requireVehicle } from '@/lib/ownership';
import { appraiseAndSave, listAppraisals } from '@/lib/appraisals';

const Body = z.object({
  vin: vinSchema,
  trim: z.string().trim().max(60).nullish(),
  mileage: mileageSchema,
  zip: zipSchema,
  condition: z.enum(['excellent', 'good', 'fair', 'rough'], { error: 'Pick a condition.' }),
  title: z.enum(['clean', 'rebuilt', 'salvage'], { error: 'Pick a title status.' }),
  accidents: z.enum(['none', 'minor', 'major'], { error: 'Pick an accident history.' }),
  serviceHistory: z.enum(['full', 'partial', 'none']).nullish(),
  owners: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullish(),
  keys: z.enum(['two', 'one']).nullish(),
  warningLights: z.enum(['none', 'check_engine', 'other']).nullish(),
  vehicleId: idSchema.nullish(),
  route: z.enum(['instant', 'private', 'retail', 'trade']).optional(),
  importedVehicle: z.boolean().optional(),
});

/**
 * POST /api/appraisals: run and save an appraisal (auth optional). POST only, so
 * VIN and ZIP never appear in query strings or access logs.
 */
export const POST = route({ auth: false, name: 'appraisals.create', rateLimit: RULES.appraise }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  const report = await appraiseAndSave(getDb(), getProviders(), {
    userId,
    vehicleId: b.vehicleId ?? null,
    route: b.route,
    importedVehicle: b.importedVehicle,
    inputs: {
      vin: b.vin,
      trim: b.trim || null,
      mileage: b.mileage,
      zip: b.zip,
      condition: b.condition,
      title: b.title,
      accidents: b.accidents,
      serviceHistory: b.serviceHistory ?? null,
      owners: b.owners ?? null,
      keys: b.keys ?? null,
      warningLights: b.warningLights ?? null,
    },
  });
  return json(report, { status: 201 });
});

const Query = z.object({ vehicleId: idSchema.optional() });

/** GET /api/appraisals?vehicleId=: Activity list for the signed-in user. Takes no VIN or ZIP. */
export const GET = route({ auth: true, name: 'appraisals.list' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  const db = getDb();
  if (q.vehicleId) await requireVehicle(db, userId, q.vehicleId);
  return json({ items: await listAppraisals(db, userId, { vehicleId: q.vehicleId }) });
});
