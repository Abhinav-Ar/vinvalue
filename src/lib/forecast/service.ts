/** Value tracker orchestration (DB only). Math lives in ./index.ts. */
import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { appraisals, marketSnapshots, odometerReadings } from '@/lib/db/schema';
import { AppError } from '@/lib/errors';
import { requireVehicle } from '@/lib/ownership';
import { median } from '@/lib/stats';
import { forecastConfig } from '@/config/forecast';
import { forecastValue, observedMilesPerYear, seasonalityFromSeries, type ForecastPoint } from './index';

export const noAppraisalError = () =>
  new AppError(409, 'conflict', 'Appraise this car first. The tracker starts from its latest appraisal.');

export type ValueTrackerView = {
  vehicleId: string;
  today: { date: string; value: number };
  milesPerYear: number;
  milesPerYearSource: 'query' | 'observed' | 'default';
  history: { date: string; value: number }[];
  forecast: ForecastPoint[];
  in12: number;
  expectedDrop: number;
  bestMonthToSell: { month: string; value: number };
  seasonalitySource: 'market' | 'default';
  disclaimer: string;
};

/** Monthly medians for a modelKey across every stored ZIP/radius (median of snapshot medians). */
export async function monthlyModelMedians(db: Db, modelKey: string) {
  const rows = await db
    .select({ d: marketSnapshots.snapshotDate, a: marketSnapshots.aggregates })
    .from(marketSnapshots)
    .where(eq(marketSnapshots.modelKey, modelKey));
  const byMonth = new Map<string, number[]>();
  for (const r of rows) {
    if (r.a.medianPrice == null) continue;
    const m = r.d.slice(0, 7);
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(r.a.medianPrice);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, xs]) => ({ month, median: median(xs) }));
}

export async function getValueTracker(
  db: Db,
  userId: string,
  vehicleId: string,
  opts: { milesPerYear?: number; today: string },
): Promise<ValueTrackerView> {
  const v = await requireVehicle(db, userId, vehicleId);
  const apps = await db
    .select({ createdAt: appraisals.createdAt, privateValue: appraisals.privateValue })
    .from(appraisals)
    .where(eq(appraisals.vehicleId, v.id))
    .orderBy(asc(appraisals.createdAt));
  const latest = apps[apps.length - 1];
  const V0 = v.lastPrivateValue ?? latest?.privateValue.value ?? null;
  if (V0 == null) throw noAppraisalError();

  let milesPerYear = opts.milesPerYear;
  let source: ValueTrackerView['milesPerYearSource'] = 'query';
  if (milesPerYear == null) {
    const readings = await db
      .select({ miles: odometerReadings.miles, recordedOn: odometerReadings.recordedOn })
      .from(odometerReadings)
      .where(eq(odometerReadings.vehicleId, v.id));
    const observed = observedMilesPerYear(readings);
    milesPerYear = observed ?? forecastConfig.baselineMilesPerYear;
    source = observed != null ? 'observed' : 'default';
  }

  const seasonality = seasonalityFromSeries(await monthlyModelMedians(db, v.modelKey));
  const f = forecastValue({
    today: opts.today,
    currentValue: V0,
    modelYear: v.specs.year,
    milesPerYear,
    seasonality: seasonality ?? undefined,
  });
  return {
    vehicleId: v.id,
    today: { date: opts.today, value: V0 },
    milesPerYear,
    milesPerYearSource: source,
    history: apps.map((a) => ({ date: a.createdAt.toISOString().slice(0, 10), value: a.privateValue.value })),
    forecast: f.points,
    in12: f.in12,
    expectedDrop: f.expectedDrop,
    bestMonthToSell: f.bestMonthToSell,
    seasonalitySource: seasonality ? 'market' : 'default',
    disclaimer: 'Forecast is an estimate: seasonality plus typical depreciation for this model, not a guarantee.',
  };
}
