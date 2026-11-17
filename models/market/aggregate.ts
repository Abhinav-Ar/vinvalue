import { eligibleListings } from '@/models/valuation';
/**
 * Market aggregates (PURE).
 */
import type { MarketAggregates } from '@/models/db/schema';
import type { Listing } from '@/models/providers/types';
import { median, quantile, roundTo } from '@/models/stats';

export const marketConfig = {
  /** Listings pulled per uncached snapshot; MarketCheck pages at 50, so ceil(100/50) = 2 calls. */
  maxResults: 100,
  pageSize: 50,
  /**
   * modelKey carries no model year, and the snapshot cache key has none either, so every
   * snapshot uses one year window: (snapshot year - yearsBack) .. (snapshot year + 1).
   */
  yearsBack: 10,
  bucketCount: 6,
  /** Bucket width is 1k when the middle 80% of prices spans <= narrowSpread, else 2k. */
  narrowSpread: 6000,
  /** priceChange90d compares with the snapshot closest to 90 days ago within this window. */
  change90Window: { minDays: 75, maxDays: 105 },
} as const;

export function bucketize(prices: number[], center?: number) {
  if (!prices.length) return [];
  const c = marketConfig;
  const mid = center ?? median(prices);
  const spread = quantile(prices, 0.9) - quantile(prices, 0.1);
  const width = spread <= c.narrowSpread ? 1000 : 2000;
  const start = roundTo(mid, width) - (c.bucketCount / 2) * width;
  const buckets = Array.from({ length: c.bucketCount }, (_, i) => ({ from: start + i * width, to: start + (i + 1) * width, count: 0 }));
  for (const p of prices) buckets[bucketIndex(buckets, p)]!.count++;
  return buckets;
}

/** Index of the bucket containing value; values outside fall into the first/last bucket. */
export function bucketIndex(buckets: { from: number; to: number }[], value: number): number {
  if (!buckets.length) return -1;
  for (let i = 0; i < buckets.length; i++) if (value < buckets[i]!.to) return i;
  return buckets.length - 1;
}

export function aggregateListings(raw: Listing[], numFound: number): MarketAggregates {
  // Same car on several sites counts once; certified (CPO) asks are a different market.
  const { listings, duplicatesRemoved, certifiedRemoved } = eligibleListings(raw);
  numFound = Math.max(0, numFound - duplicatesRemoved - certifiedRemoved);
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  const doms = listings.map((l) => l.daysOnMarket).filter((d): d is number => d != null);
  const miles = listings.map((l) => l.miles);
  return {
    count: Math.max(numFound, listings.length),
    medianPrice: prices.length ? roundTo(median(prices), 10) : null,
    medianDaysOnMarket: doms.length ? Math.round(median(doms)) : null,
    medianMiles: miles.length ? Math.round(median(miles)) : null,
    buckets: bucketize(prices),
  };
}

const dayMs = 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);

export function addMonthsYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

type Snap = { snapshotDate: string; aggregates: MarketAggregates };

/** 12 monthly medians ending at today's month (latest snapshot in each month), null when missing. */
export function series12(snaps: Snap[], today: string): { month: string; median: number | null }[] {
  const ym = today.slice(0, 7);
  const byMonth = new Map<string, Snap>();
  for (const s of snaps) {
    const m = s.snapshotDate.slice(0, 7);
    const prev = byMonth.get(m);
    if (!prev || s.snapshotDate > prev.snapshotDate) byMonth.set(m, s);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonthsYm(ym, i - 11);
    return { month, median: byMonth.get(month)?.aggregates.medianPrice ?? null };
  });
}

/** Percent change of current median vs the snapshot closest to 90 days ago (1 decimal), or null. */
export function priceChange90d(snaps: Snap[], today: string, currentMedian: number | null): number | null {
  if (currentMedian == null) return null;
  const { minDays, maxDays } = marketConfig.change90Window;
  let best: Snap | null = null;
  for (const s of snaps) {
    const d = daysBetween(s.snapshotDate, today);
    if (d < minDays || d > maxDays || s.aggregates.medianPrice == null) continue;
    if (!best || Math.abs(d - 90) < Math.abs(daysBetween(best.snapshotDate, today) - 90)) best = s;
  }
  if (!best) return null;
  const old = best.aggregates.medianPrice!;
  return Math.round(((currentMedian - old) / old) * 1000) / 10;
}
