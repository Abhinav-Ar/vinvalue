/** Sell plan orchestration (DB only). Rules in src/config/states, math in ./index.ts. */
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { appraisals, serviceEvents } from '@/lib/db/schema';
import { requireVehicle } from '@/lib/ownership';
import { rulesFor, stateFromZip } from '@/config/states';
import { noAppraisalError } from '@/lib/forecast/service';
import { buildListingKit, planSale, type ListingKit, type SellPlan } from './index';

export type SellPlanView = SellPlan & { vehicleId: string; askingPrice: number; loanPayoff: number; listingKit: ListingKit };

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export async function getSellPlan(
  db: Db,
  userId: string,
  vehicleId: string,
  input: { loanPayoff: number; askingPrice?: number; state?: string },
  today: string,
): Promise<SellPlanView> {
  const v = await requireVehicle(db, userId, vehicleId);
  const [latest] = await db
    .select()
    .from(appraisals)
    .where(eq(appraisals.vehicleId, v.id))
    .orderBy(desc(appraisals.createdAt))
    .limit(1);
  if (!latest) throw noAppraisalError();

  const state = input.state?.toUpperCase() ?? stateFromZip(v.zip);
  const rules = rulesFor(state);
  const askingPrice = input.askingPrice ?? latest.privateValue.value;
  const plan = planSale({
    instantValue: latest.instantValue.value,
    askingPrice,
    loanPayoff: input.loanPayoff,
    state,
    rules,
    modelYear: v.specs.year,
    fuel: v.specs.fuel,
    today,
  });

  const [done] = await db
    .select({ id: serviceEvents.id })
    .from(serviceEvents)
    .where(and(eq(serviceEvents.vehicleId, v.id), eq(serviceEvents.status, 'done')))
    .limit(1);
  const listingKit = buildListingKit({
    specs: v.specs,
    trim: v.trim ?? latest.inputs.trim,
    odometer: v.odometer,
    titleStatus: latest.inputs.title ?? null,
    hasServiceRecords: !!done,
    reportLink: `${appUrl()}/r/${latest.shareSlug}`,
  });
  return { vehicleId: v.id, askingPrice, loanPayoff: input.loanPayoff, ...plan, listingKit };
}
