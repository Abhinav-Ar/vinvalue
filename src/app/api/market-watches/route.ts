import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { createMarketWatch, listMarketWatches } from '@/lib/watches/service';
import { MarketWatchBody } from '@/lib/market/schema';

/** POST /api/market-watches {modelKey, zip, radiusMiles, thresholdPct?} */
export const POST = route({ auth: true, name: 'market_watches.create' }, async ({ req, userId }) => {
  const b = await parseJson(req, MarketWatchBody);
  return json(await createMarketWatch(getDb(), userId!, b), { status: 201 });
});

/** GET /api/market-watches */
export const GET = route({ auth: true, name: 'market_watches.list' }, async ({ userId }) => {
  return json({ items: await listMarketWatches(getDb(), userId!) });
});
