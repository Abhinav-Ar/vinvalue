import { route, json, parseQuery, parseJson } from '@/models/http';
import { getDb } from '@/models/db';
import { deleteBuyCheck as deleteBuyCheckModel, compareBuyChecks as compareBuyChecksModel, listBuyChecks as listBuyChecksModel, saveBuyCheck } from '@/models/buy/service';
import { z } from 'zod';
import { RULES } from '@/models/ratelimit';
import { getProviders } from '@/models/providers';
import { isoToday } from '@/models/market/service';
import { PriceCheckBody } from '@/models/buy/schema';
/** DELETE /api/buy-checks/[id] */
export const deleteBuyCheck = route<{ id: string }, true>({ auth: true, name: 'buy_checks.delete' }, async ({ params, userId }) => {
  await deleteBuyCheckModel(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
const Query = z.object({ ids: z.string({ error: 'Pass ids=a,b,c.' }).min(1) });

/** GET /api/buy-checks/compare?ids=a,b,c (max 3) */
export const compareBuyChecks = route({ auth: true, name: 'buy_checks.compare' }, async ({ req, userId }) => {
  const q = parseQuery(req, Query);
  const ids = q.ids.split(',').map((s) => s.trim()).filter(Boolean);
  return json({ rows: await compareBuyChecksModel(getDb(), userId!, ids) });
});
/** POST /api/buy-checks: run the price check and save it with its verdict snapshot. */
export const createBuyCheck = route({ auth: true, name: 'buy_checks.create', rateLimit: RULES.priceCheck }, async ({ req, userId }) => {
  const b = await parseJson(req, PriceCheckBody);
  return json(await saveBuyCheck(getDb(), getProviders(), userId!, b, isoToday()), { status: 201 });
});

/** GET /api/buy-checks: the signed-in user's saved checks, newest first. */
export const listBuyChecks = route({ auth: true, name: 'buy_checks.list' }, async ({ userId }) => {
  return json({ items: await listBuyChecksModel(getDb(), userId!) });
});
