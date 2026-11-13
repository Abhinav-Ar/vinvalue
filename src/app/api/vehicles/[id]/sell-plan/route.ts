import { z } from 'zod';
import { json, parseJson, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { dollarsSchema } from '@/lib/validation';
import { getSellPlan } from '@/lib/sell/service';
import { isoToday } from '@/lib/market/service';

const Body = z.object({
  loanPayoff: dollarsSchema().default(0),
  askingPrice: dollarsSchema().optional(),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a 2-letter state code.').optional(),
});

/** POST /api/vehicles/[id]/sell-plan: instant vs trade-in vs private, with state checklist and listing kit. */
export const POST = route<{ id: string }, true>({ auth: true, name: 'vehicles.sell_plan' }, async ({ req, params, userId }) => {
  const b = await parseJson(req, Body);
  return json(await getSellPlan(getDb(), userId, params.id, b, isoToday()));
});
