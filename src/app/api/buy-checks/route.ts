import { json, parseJson, route } from '@/lib/http';
import { RULES } from '@/lib/ratelimit';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { listBuyChecks, saveBuyCheck } from '@/lib/buy/service';
import { isoToday } from '@/lib/market/service';
import { PriceCheckBody } from '@/lib/buy/schema';

/** POST /api/buy-checks: run the price check and save it with its verdict snapshot. */
export const POST = route({ auth: true, name: 'buy_checks.create', rateLimit: RULES.priceCheck }, async ({ req, userId }) => {
  const b = await parseJson(req, PriceCheckBody);
  return json(await saveBuyCheck(getDb(), getProviders(), userId!, b, isoToday()), { status: 201 });
});

/** GET /api/buy-checks: the signed-in user's saved checks, newest first. */
export const GET = route({ auth: true, name: 'buy_checks.list' }, async ({ userId }) => {
  return json({ items: await listBuyChecks(getDb(), userId!) });
});
