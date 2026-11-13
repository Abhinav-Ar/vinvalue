import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { RULES } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { vinSchema } from '@/lib/validation';
import { decodeVin } from '@/lib/vin-decode';

const Body = z.object({ vin: vinSchema, importedVehicle: z.boolean().optional() });

/** POST /api/vin/decode { vin, importedVehicle? } -> decoded vehicle + trim candidates. */
export const POST = route({ auth: false, name: 'vin.decode', rateLimit: RULES.decode }, async ({ req }) => {
  const { vin, importedVehicle } = await parseJson(req, Body);
  const d = await decodeVin(getDb(), getProviders(), vin, { importedVehicle });
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
