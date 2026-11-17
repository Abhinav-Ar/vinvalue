import { z } from 'zod';
import { json, parseQuery, route } from '@/models/http';
import { RULES } from '@/models/ratelimit';
import { getDb } from '@/models/db';
import { getProviders } from '@/models/providers';
import { badRequest, unauthorized } from '@/models/errors';
import { requireVehicle } from '@/models/ownership';
import { idSchema, radiusSchema, zipSchema } from '@/models/validation';
import { getMarket as getMarketModel, isoToday } from '@/models/market/service';
import { modelKeySchema } from '@/models/market/schema';
const Query = z.object({
  modelKey: modelKeySchema.optional(),
  zip: zipSchema.optional(),
  radius: radiusSchema.optional(),
  vehicleId: idSchema.optional(),
});

/**
 * GET /api/market?modelKey&zip&radius=25|50|100[&vehicleId]
 * Auth optional; vehicleId (must be yours) fills modelKey/zip and marks your value.
 * Cache miss = 2 MarketCheck calls; cache hit (today's snapshot) = 0.
 */
export const getMarket = route({ auth: false, name: 'market.get', rateLimit: RULES.market }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  const db = getDb();
  let modelKey = q.modelKey;
  let zip = q.zip;
  let yourValue: number | undefined;
  if (q.vehicleId) {
    if (!userId) throw unauthorized();
    const v = await requireVehicle(db, userId, q.vehicleId);
    modelKey ??= v.modelKey;
    zip ??= v.zip;
    yourValue = v.lastPrivateValue ?? undefined;
  }
  if (!modelKey || !zip) {
    throw badRequest('Some fields are invalid.', {
      ...(!modelKey ? { modelKey: ['Pick a model.'] } : {}),
      ...(!zip ? { zip: ['ZIP code is required.'] } : {}),
    });
  }
  return json(await getMarketModel(db, getProviders(), { modelKey, zip, radiusMiles: q.radius ?? 100, yourValue, today: isoToday() }));
});
