import { json, parseJson, route } from '@/lib/http';
import { RULES } from '@/lib/ratelimit';
import { getProviders } from '@/lib/providers';
import { getDb } from '@/lib/db';
import { runPriceCheck } from '@/lib/buy/service';
import { PriceCheckBody } from '@/lib/buy/schema';
import { isoToday } from '@/lib/market/service';

/** POST /api/price-check: public fair-price verdict for a car you are considering. */
export const POST = route({ auth: false, name: 'price_check', rateLimit: RULES.priceCheck }, async ({ req }) => {
  const b = await parseJson(req, PriceCheckBody);
  const { result } = await runPriceCheck(getDb(), getProviders(), b, isoToday());
  return json(result);
});
