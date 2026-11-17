/** Small pure stats helpers shared by valuation, buy check and market. */

export function median(xs: number[]): number {
  if (!xs.length) throw new Error('median of empty list');
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Linear-interpolated quantile (same as numpy default / Excel PERCENTILE.INC). */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) throw new Error('quantile of empty list');
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/**
 * Weighted median: smallest value v such that the cumulative weight of items
 * <= v reaches half the total weight. If the half-point falls exactly on a
 * boundary, averages the two neighbors (so equal weights == plain median).
 */
export function weightedMedian(items: { value: number; weight: number }[]): number {
  const xs = items.filter((i) => i.weight > 0).sort((a, b) => a.value - b.value);
  if (!xs.length) throw new Error('weightedMedian of empty list');
  const total = xs.reduce((a, b) => a + b.weight, 0);
  let cum = 0;
  for (let i = 0; i < xs.length; i++) {
    cum += xs[i]!.weight;
    if (Math.abs(cum - total / 2) < 1e-9 && i + 1 < xs.length) return (xs[i]!.value + xs[i + 1]!.value) / 2;
    if (cum > total / 2) return xs[i]!.value;
  }
  return xs[xs.length - 1]!.value;
}

export function mean(xs: number[]): number {
  if (!xs.length) throw new Error('mean of empty list');
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export const roundTo = (n: number, step: number) => Math.round(n / step) * step;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
