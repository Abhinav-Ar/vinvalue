import { outcomeSchema } from '@/models/appraisals/outcomeValidation';
import { z } from 'zod';
import { json, parseJson, parseQuery, route } from '@/models/http';
import { RULES } from '@/models/ratelimit';
import { getDb } from '@/models/db';
import { getProviders } from '@/models/providers';
import { idSchema, mileageSchema, vinSchema, zipSchema } from '@/models/validation';
import { requireVehicle } from '@/models/ownership';
import { appraiseAndSave, listAppraisals as listAppraisalsModel, recordSaleOutcome } from '@/models/appraisals';
const CreateAppraisalBody = z.object({
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
  lien: z.enum(['none','has_lien','unknown']).optional(),
  mechanicalIssues: z.enum(['none','minor','major','unknown']).optional(),
  bodyDamage: z.enum(['none','minor','major','unknown']).optional(),
  featureFailures: z.enum(['none','some','many','unknown']).optional(),
  tires: z.enum(['good','fair','replace','unknown']).optional(),
  glass: z.enum(['good','damaged','unknown']).optional(),
  interior: z.enum(['clean','worn','dirty','unknown']).optional(),
  odors: z.enum(['none','smoke','pet','other','unknown']).optional(),
  roof: z.enum(['standard','sunroof','panoramic','unknown']).optional(),
  vehicleId: idSchema.nullish(),
  route: z.enum(['instant', 'private', 'retail', 'trade']).optional(),
  importedVehicle: z.boolean().optional(),
});

/**
 * POST /api/appraisals: run and save an appraisal (auth optional). POST only, so
 * VIN and ZIP never appear in query strings or access logs.
 */
export const createAppraisal = route({ auth: false, name: 'appraisals.create', rateLimit: RULES.appraise }, async ({ req, userId }) => {
  const b = await parseJson(req, CreateAppraisalBody);
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
      lien: b.lien ?? 'unknown', mechanicalIssues: b.mechanicalIssues ?? 'unknown', bodyDamage: b.bodyDamage ?? 'unknown', featureFailures: b.featureFailures ?? 'unknown', tires: b.tires ?? 'unknown', glass: b.glass ?? 'unknown', interior: b.interior ?? 'unknown', odors: b.odors ?? 'unknown', roof: b.roof ?? 'unknown', conditionVersion: 'recon-v1',
    },
  });
  return json(report, { status: 201 });
});

const Query = z.object({ vehicleId: idSchema.optional() });

/** GET /api/appraisals?vehicleId=: Activity list for the signed-in user. Takes no VIN or ZIP. */
export const listAppraisals = route({ auth: true, name: 'appraisals.list' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  const db = getDb();
  if (q.vehicleId) await requireVehicle(db, userId, q.vehicleId);
  return json({ items: await listAppraisalsModel(db, userId, { vehicleId: q.vehicleId }) });
});
/** POST /api/appraisals/[id]/outcome: owner-only. id may also be a durable sale-feedback ID for a removed/unappraised vehicle. */
export const recordAppraisalOutcome = route<{ id: string }, true>({ auth: true, name: 'appraisals.outcome' }, async ({ req, params, userId }) => {
  const body = await parseJson(req, outcomeSchema);
  const o = await recordSaleOutcome(getDb(), userId, params.id, body);
  return json({ id: o.id, soldPrice: o.soldPrice, route: o.route, soldOn: o.soldOn }, { status: 201 });
});
