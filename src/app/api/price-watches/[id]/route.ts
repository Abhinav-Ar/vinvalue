import { route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { deletePriceWatch } from '@/lib/watches/service';

/** DELETE /api/price-watches/[id] */
export const DELETE = route<{ id: string }, true>({ auth: true, name: 'price_watches.delete' }, async ({ params, userId }) => {
  await deletePriceWatch(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
