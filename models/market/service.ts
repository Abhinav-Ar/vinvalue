/**
 * Market snapshots + market view (DB + providers).
 *
 * MarketCheck call budget: a cache miss costs one snapshot = ceil(maxResults / 50) = 2 calls.
 * A cache hit (today's snapshot for modelKey+zip+radius exists) costs 0 calls.
 */
import { and, desc, eq, gte } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { marketSnapshots, type MarketAggregates } from '@/models/db/schema';
import { parseModelKey } from '@/shared/model-key';
import type { Providers } from '@/models/providers/types';
import { badRequest } from '@/models/errors';
import {
  aggregateListings, bucketIndex, marketConfig, priceChange90d, series12, addMonthsYm,
} from './aggregate';

export type MarketSnapshot = typeof marketSnapshots.$inferSelect;

export type MarketView = {
  modelKey: string;
  zip: string;
  radiusMiles: number;
  snapshotDate: string;
  activeListings: number;
  medianAsking: number | null;
  medianDaysOnMarket: number | null;
  medianMiles: number | null;
  /** Percent, one decimal; null when there is no snapshot about 90 days old. */
  priceChange90d: number | null;
  series12: { month: string; median: number | null }[];
  buckets: { from: number; to: number; count: number }[];
  yourValue: number | null;
  yourBucketIndex: number | null;
  /** true when served from today's stored snapshot (no provider call). */
  cached: boolean;
};

export const isoToday = () => new Date().toISOString().slice(0, 10);

export async function takeMarketSnapshot(
  db: Db,
  providers: Providers,
  args: { modelKey: string; zip: string; radiusMiles: number; date: string },
): Promise<MarketSnapshot> {
  const { make, model, trim } = parseModelKey(args.modelKey);
  if (!make || !model) throw badRequest('modelKey must look like "make|model|trim".', { modelKey: ['Invalid model key.'] });
  const year = Number(args.date.slice(0, 4));
  const res = await providers.listings.searchActive({
    make, model, trim,
    yearFrom: year - marketConfig.yearsBack,
    yearTo: year + 1,
    zip: args.zip,
    radiusMiles: args.radiusMiles,
    maxResults: marketConfig.maxResults,
  });
  const aggregates: MarketAggregates = aggregateListings(res.listings, res.numFound);
  const [row] = await db
    .insert(marketSnapshots)
    .values({ modelKey: args.modelKey, zip: args.zip, radiusMiles: args.radiusMiles, snapshotDate: args.date, aggregates })
    .onConflictDoUpdate({
      target: [marketSnapshots.modelKey, marketSnapshots.zip, marketSnapshots.radiusMiles, marketSnapshots.snapshotDate],
      set: { aggregates },
    })
    .returning();
  return row!;
}

/** Snapshots for a market since `fromDate` (inclusive), newest first. */
export async function snapshotsSince(db: Db, key: { modelKey: string; zip: string; radiusMiles: number }, fromDate: string) {
  return db
    .select()
    .from(marketSnapshots)
    .where(and(
      eq(marketSnapshots.modelKey, key.modelKey),
      eq(marketSnapshots.zip, key.zip),
      eq(marketSnapshots.radiusMiles, key.radiusMiles),
      gte(marketSnapshots.snapshotDate, fromDate),
    ))
    .orderBy(desc(marketSnapshots.snapshotDate));
}

export async function getMarket(
  db: Db,
  providers: Providers,
  args: { modelKey: string; zip: string; radiusMiles: 25 | 50 | 100; yourValue?: number; today?: string },
): Promise<MarketView> {
  const today = args.today ?? isoToday();
  const key = { modelKey: args.modelKey, zip: args.zip, radiusMiles: args.radiusMiles };
  const from = `${addMonthsYm(today.slice(0, 7), -11)}-01`;
  const earliest = from < shiftDays(today, -marketConfig.change90Window.maxDays) ? from : shiftDays(today, -marketConfig.change90Window.maxDays);
  const snaps = await snapshotsSince(db, key, earliest);
  let current = snaps.find((s) => s.snapshotDate === today) ?? null;
  const cached = !!current;
  if (!current) {
    current = await takeMarketSnapshot(db, providers, { ...key, date: today });
    snaps.unshift(current);
  }
  const a = current.aggregates;
  const buckets = a.buckets.length ? a.buckets : [];
  const yourValue = args.yourValue ?? null;
  const idx = yourValue != null && buckets.length ? bucketIndex(buckets, yourValue) : null;
  return {
    ...key,
    snapshotDate: current.snapshotDate,
    activeListings: a.count,
    medianAsking: a.medianPrice,
    medianDaysOnMarket: a.medianDaysOnMarket,
    medianMiles: a.medianMiles,
    priceChange90d: priceChange90d(snaps, today, a.medianPrice),
    series12: series12(snaps.filter((s) => s.snapshotDate >= from), today),
    buckets,
    yourValue,
    yourBucketIndex: idx,
    cached,
  };
}

export function shiftDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);
}

