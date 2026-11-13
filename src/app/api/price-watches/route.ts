import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { dollarsSchema, idSchema } from '@/lib/validation';
import { createPriceWatch, listPriceWatches } from '@/lib/watches/service';

const Body = z.object({
  vehicleId: idSchema.nullish(),
  buyCheckId: idSchema.nullish(),
  threshold: dollarsSchema(),
  direction: z.enum(['below', 'above'], { error: 'Pick below or above.' }),
});

/** POST /api/price-watches {vehicleId | buyCheckId, threshold, direction} */
export const POST = route({ auth: true, name: 'price_watches.create' }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  return json(await createPriceWatch(getDb(), userId!, b), { status: 201 });
});

/** GET /api/price-watches */
export const GET = route({ auth: true, name: 'price_watches.list' }, async ({ userId }) => {
  return json({ items: await listPriceWatches(getDb(), userId!) });
});
