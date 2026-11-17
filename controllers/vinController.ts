import { z } from 'zod';
import { json, parseJson, route } from '@/models/http';
import { RULES } from '@/models/ratelimit';
import { getDb } from '@/models/db';
import { getProviders } from '@/models/providers';
import { vinSchema } from '@/models/validation';
import { decodeVin as decodeVinModel } from '@/models/vin-decode';
const Body = z.object({ vin: vinSchema, importedVehicle: z.boolean().optional() });

/** POST /api/vin/decode { vin, importedVehicle? } -> decoded vehicle + trim candidates. */
export const decodeVin = route({ auth: false, name: 'vin.decode', rateLimit: RULES.decode }, async ({ req }) => {
  const { vin, importedVehicle } = await parseJson(req, Body);
  const d = await decodeVinModel(getDb(), getProviders(), vin, { importedVehicle });
  const { vin: _vin, warnings, raw: _raw, ...specs } = d as typeof d & { raw?: unknown };
  return json({
    vin,
    year: d.year,
    make: d.make,
    model: d.model,
    trimCandidates: d.trimCandidates,
    needsTrimChoice: d.trimCandidates.length > 1,
    decodeStatus: d.decodeStatus ?? 'clean',
    /** Partial vPIC decode: the UI must ask the user to confirm the details. */
    needsConfirmation: d.decodeStatus === 'partial',
    specs,
    warnings,
  });
});
