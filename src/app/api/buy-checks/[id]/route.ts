import { route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { deleteBuyCheck } from '@/lib/buy/service';

/** DELETE /api/buy-checks/[id] */
export const DELETE = route<{ id: string }, true>({ auth: true, name: 'buy_checks.delete' }, async ({ params, userId }) => {
  await deleteBuyCheck(getDb(), userId, params.id);
  return new Response(null, { status: 204 });
});
