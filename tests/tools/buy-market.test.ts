import { describe, it, expect } from 'vitest';
import { buildVerdict, suggestedOffer, verdictFor } from '@/lib/buy/verdict';
import { aggregateListings, bucketIndex, bucketize, priceChange90d, series12 } from '@/lib/market/aggregate';
import type { Listing } from '@/lib/providers/types';
import type { MarketAggregates } from '@/lib/db/schema';

describe('buy verdict', () => {
  it('boundaries are inclusive on the fair range', () => {
    expect(verdictFor(28599, 28600, 31200)).toBe('below');
    expect(verdictFor(28600, 28600, 31200)).toBe('fair');
    expect(verdictFor(31200, 28600, 31200)).toBe('fair');
    expect(verdictFor(31201, 28600, 31200)).toBe('above');
  });

  it('first offer = round50(min(ask - 700, mid - 300))', () => {
    expect(suggestedOffer(28900, 29900)).toBe(28200); // design
    expect(suggestedOffer(28930, 31000)).toBe(28250); // 28230 rounds up
    expect(suggestedOffer(28920, 31000)).toBe(28200); // 28220 rounds down
    expect(suggestedOffer(40000, 30000)).toBe(29700); // mid side wins
    expect(suggestedOffer(100, 100)).toBe(0);
  });

  it('dealer uses retail range, private uses private range', () => {
    const args = {
      askingPrice: 28900, compCount: 20, computedAt: '2026-11-12',
      privateRange: { value: 26650, low: 24900, high: 28400 },
      retailRange: { value: 29900, low: 28600, high: 31200 },
    };
    const d = buildVerdict({ ...args, sellerType: 'dealer' });
    expect(d).toMatchObject({ fairLow: 28600, fairHigh: 31200, mid: 29900, verdict: 'fair', suggestedOffer: 28200 });
    const p = buildVerdict({ ...args, sellerType: 'private' });
    expect(p).toMatchObject({ fairLow: 24900, fairHigh: 28400, verdict: 'above' });
  });
});

const L = (price: number, dom = 30): Listing => ({
  id: String(price), vin: null, inventoryType: 'used', price, miles: 40000, distance: 10, year: 2019, make: 'Ford', model: 'Mustang', trim: 'GT', sellerType: 'dealer', daysOnMarket: dom,
});

describe('market aggregates', () => {
  it('buckets: 6 bins of 2k around the median (design: 27,900 -> starts at 22k)', () => {
    const prices = [21000, 23000, 25000, 26500, 27500, 27900, 28300, 29000, 30500, 33000, 36000];
    const b = bucketize(prices);
    expect(b).toHaveLength(6);
    expect(b[0]!.from).toBe(22000);
    expect(b[5]!.to).toBe(34000);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(prices.length); // edges absorb outliers
    expect(bucketIndex(b, 27450)).toBe(2);
    expect(bucketIndex(b, 1000)).toBe(0);
    expect(bucketIndex(b, 99999)).toBe(5);
  });

  it('buckets: 1k bins when prices are tight', () => {
    const b = bucketize([19000, 19400, 19600, 19700, 20100, 20300]);
    expect(b[1]!.to - b[1]!.from).toBe(1000);
    expect(b[0]!.from).toBe(17000);
  });

  it('aggregate medians and counts', () => {
    const a = aggregateListings([L(27000, 20), L(28000, 40), L(29000, 60)], 212);
    expect(a).toMatchObject({ count: 212, medianPrice: 28000, medianDaysOnMarket: 40, medianMiles: 40000 });
    expect(aggregateListings([], 0)).toMatchObject({ count: 0, medianPrice: null, buckets: [] });
  });

  const snap = (snapshotDate: string, medianPrice: number | null) => ({
    snapshotDate, aggregates: { count: 1, medianPrice, medianDaysOnMarket: 30, medianMiles: 1, buckets: [] } as MarketAggregates,
  });

  it('series12: 12 months ending this month, latest per month, null gaps', () => {
    const s = series12([snap('2026-11-12', 27900), snap('2026-10-01', 28000), snap('2026-10-20', 28100), snap('2025-11-30', 29600), snap('2025-10-01', 1)], '2026-11-12');
    expect(s).toHaveLength(12);
    expect(s[0]).toEqual({ month: '2025-12', median: null });
    expect(s[10]).toEqual({ month: '2026-10', median: 28100 });
    expect(s[11]).toEqual({ month: '2026-11', median: 27900 });
  });

  it('priceChange90d uses the snapshot closest to 90 days ago, else null', () => {
    expect(priceChange90d([snap('2026-08-14', 28500), snap('2026-08-01', 30000)], '2026-11-12', 27900)).toBe(-2.1);
    expect(priceChange90d([snap('2026-10-01', 28500)], '2026-11-12', 27900)).toBeNull();
    expect(priceChange90d([snap('2026-08-14', 28500)], '2026-11-12', null)).toBeNull();
  });
});
