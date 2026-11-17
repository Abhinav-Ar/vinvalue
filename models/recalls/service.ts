/**
 * Recall checks. The NHTSA public recalls API is by make/model/model year
 * (verified; see src/lib/providers/nhtsa.ts), NOT by VIN, so alerts say the
 * recall applies to the model year and ask the owner to confirm by VIN at
 * nhtsa.gov/recalls. TODO(data source): VIN-level recall status (basis 'vin').
 */
import { desc, eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { recallChecks, vehicles, type RecallItem } from '@/models/db/schema';
import type { Providers } from '@/models/providers';
import type { AlertDraft } from '@/shared/contracts';
import { notFound } from '@/models/errors';

/** "POWER TRAIN:AUTOMATIC TRANSMISSION:GEAR POSITION" -> "Power train, automatic transmission, gear position". */
export function formatComponent(c: string): string {
  const s = c
    .split(':')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ');
  return s ? s[0]!.toUpperCase() + s.slice(1) : 'Not specified';
}

export function recallDraft(
  v: { id: string; userId: string; specs: { year: number; make: string; model: string } },
  r: RecallItem,
): AlertDraft {
  const mm = `${v.specs.year} ${v.specs.make} ${v.specs.model}`;
  const park = r.parkIt ? ' NHTSA advises not driving affected vehicles until repaired.' : r.parkOutside ? ' NHTSA advises parking affected vehicles outside.' : '';
  return {
    userId: v.userId,
    type: 'recall',
    vehicleId: v.id,
    title: 'New recall notice to review',
    body:
      `Recall ${r.campaign} (${formatComponent(r.component)}) may apply to the ${mm} model year.${park} ` +
      'It is not confirmed for your vehicle. Check your VIN at nhtsa.gov/recalls to see if it is affected.',
    link: `/garage/${v.id}`,
    dedupeKey: `recall:${v.id}:${r.campaign}`,
  };
}

export async function checkRecalls(
  db: Db,
  providers: Providers,
  vehicleId: string,
  now: Date = new Date(),
): Promise<{ newCampaigns: RecallItem[]; drafts: AlertDraft[] }> {
  const [v] = await db
    .select({ id: vehicles.id, userId: vehicles.userId, specs: vehicles.specs })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId))
    .limit(1);
  if (!v) throw notFound('Vehicle');

  const results = (await providers.recalls.byModelYear(v.specs.make, v.specs.model, v.specs.year)).filter((r) => r.campaign);
  const [prev] = await db
    .select({ results: recallChecks.results })
    .from(recallChecks)
    .where(eq(recallChecks.vehicleId, vehicleId))
    .orderBy(desc(recallChecks.checkedAt))
    .limit(1);
  await db.insert(recallChecks).values({ vehicleId, checkedAt: now, basis: 'model_year', results });

  // First-ever check: every campaign returned counts as new (the API has no open/closed flag).
  const known = new Set((prev?.results ?? []).map((r) => r.campaign));
  const seen = new Set<string>();
  const newCampaigns = results.filter((r) => !known.has(r.campaign) && !seen.has(r.campaign) && seen.add(r.campaign));
  return { newCampaigns, drafts: newCampaigns.map((r) => recallDraft(v, r)) };
}
