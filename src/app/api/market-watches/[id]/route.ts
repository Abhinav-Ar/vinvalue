import { route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { deleteMarketWatch } from '@/lib/watches/service';

/** DELETE /api/market-watches/[id] */
export const DELETE = route<{ id: string }, true>({ auth: true, name: 'market_watches.delete' }, async ({ params, userId }) => {
  await deleteMarketWatch(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
