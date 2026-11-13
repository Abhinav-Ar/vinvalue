import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { RULES } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { badRequest, unauthorized } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { idSchema, radiusSchema, zipSchema } from '@/lib/validation';
import { getMarket, isoToday } from '@/lib/market/service';
import { modelKeySchema } from '@/lib/market/schema';

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
export const GET = route({ auth: false, name: 'market.get', rateLimit: RULES.market }, async ({ req, userId }) => {
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
  return json(await getMarket(db, getProviders(), { modelKey, zip, radiusMiles: q.radius ?? 100, yourValue, today: isoToday() }));
});
