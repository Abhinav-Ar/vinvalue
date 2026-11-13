import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { dollarsSchema, isoDateSchema } from '@/lib/validation';
import { recordSaleOutcome } from '@/lib/appraisals';

const Body = z.object({
  soldPrice: dollarsSchema(),
  route: z.enum(['instant', 'private', 'retail', 'trade'], { error: 'Pick how you sold it.' }),
  soldOn: isoDateSchema,
});

/** POST /api/appraisals/[id]/outcome: record the actual sale price (owner only). */
export const POST = route<{ id: string }, true>({ auth: true, name: 'appraisals.outcome' }, async ({ req, params, userId }) => {
  const body = await parseJson(req, Body);
  const o = await recordSaleOutcome(getDb(), userId, params.id, body);
  return json({ id: o.id, soldPrice: o.soldPrice, route: o.route, soldOn: o.soldOn }, { status: 201 });
});
