import { route, json, parseJson } from '@/models/http';
import { getDb } from '@/models/db';
import { deleteMarketWatch as deleteMarketWatchModel, createMarketWatch as createMarketWatchModel, listMarketWatches as listMarketWatchesModel } from '@/models/watches/service';
import { MarketWatchBody } from '@/models/market/schema';
/** DELETE /api/market-watches/[id] */
export const deleteMarketWatch = route<{ id: string }, true>({ auth: true, name: 'market_watches.delete' }, async ({ params, userId }) => {
  await deleteMarketWatchModel(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
/** POST /api/market-watches {modelKey, zip, radiusMiles, thresholdPct?} */
export const createMarketWatch = route({ auth: true, name: 'market_watches.create' }, async ({ req, userId }) => {
  const b = await parseJson(req, MarketWatchBody);
  return json(await createMarketWatchModel(getDb(), userId!, b), { status: 201 });
});

/** GET /api/market-watches */
export const listMarketWatches = route({ auth: true, name: 'market_watches.list' }, async ({ userId }) => {
  return json({ items: await listMarketWatchesModel(getDb(), userId!) });
});
