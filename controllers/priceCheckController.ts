import { json, parseJson, route } from '@/models/http';
import { RULES } from '@/models/ratelimit';
import { getProviders } from '@/models/providers';
import { getDb } from '@/models/db';
import { runPriceCheck } from '@/models/buy/service';
import { PriceCheckBody } from '@/models/buy/schema';
import { isoToday } from '@/models/market/service';
/** POST /api/price-check: public fair-price verdict for a car you are considering. */
export const createPriceCheck = route({ auth: false, name: 'price_check', rateLimit: RULES.priceCheck }, async ({ req }) => {
  const b = await parseJson(req, PriceCheckBody);
  const { result } = await runPriceCheck(getDb(), getProviders(), b, isoToday());
  return json(result);
});
