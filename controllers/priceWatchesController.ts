import { route, json, parseJson } from '@/models/http';
import { getDb } from '@/models/db';
import { deletePriceWatch as deletePriceWatchModel, createPriceWatch as createPriceWatchModel, listPriceWatches as listPriceWatchesModel } from '@/models/watches/service';
import { z } from 'zod';
import { dollarsSchema, idSchema } from '@/models/validation';
/** DELETE /api/price-watches/[id] */
export const deletePriceWatch = route<{ id: string }, true>({ auth: true, name: 'price_watches.delete' }, async ({ params, userId }) => {
  await deletePriceWatchModel(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
const Body = z.object({
  vehicleId: idSchema.nullish(),
  buyCheckId: idSchema.nullish(),
  threshold: dollarsSchema(),
  direction: z.enum(['below', 'above'], { error: 'Pick below or above.' }),
});

/** POST /api/price-watches {vehicleId | buyCheckId, threshold, direction} */
export const createPriceWatch = route({ auth: true, name: 'price_watches.create' }, async ({ req, userId }) => {
  const b = await parseJson(req, Body);
  return json(await createPriceWatchModel(getDb(), userId!, b), { status: 201 });
});

/** GET /api/price-watches */
export const listPriceWatches = route({ auth: true, name: 'price_watches.list' }, async ({ userId }) => {
  return json({ items: await listPriceWatchesModel(getDb(), userId!) });
});
