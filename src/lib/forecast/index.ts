/**
 * Value forecast (PURE: no DB, no HTTP, "today" injected).
 *
 * Model, per month t = 1..12 after today's month m0:
 *
 *   mid_t = V0 x D(t) x S[m_t] / S[m0]  -  V0 x mileagePctPer1k x extraMiles_t / 1000
 *
 *   D(t)          compounded depreciation: prod over months k=1..t of (1 - annualPct(age_k))^(1/12),
 *                 where age_k = vehicle age (years since model year) at month k and annualPct comes
 *                 from the age bands in src/config/forecast.ts.
 *   S             seasonality index by calendar month. Measured from this modelKey's monthly
 *                 market_snapshots medians when 12+ months cover every calendar month
 *                 (log-linear detrend, average residual per calendar month, normalized to mean 1);
 *                 otherwise the default national table in config (TODO(data source)).
 *   extraMiles_t  (milesPerYear - baselineMilesPerYear) x t / 12. Can be negative (low-mileage
 *                 drivers lose value more slowly). mileagePctPer1k is the valuation engine's knob.
 *
 *   band_t        +-min(bandMaxPct, bandBasePct x sqrt(t)) around mid_t.
 *
 * Best month to sell: argmax of mid over t = 1..bestMonthWindow (earliest wins ties).
 * Everything is rounded to $10 for display. Deterministic.
 */
import { forecastConfig, type ForecastConfig } from '@/config/forecast';
import { valuationConfig } from '@/config/valuation';
import { roundTo } from '@/lib/stats';

export type ForecastPoint = { month: string; mid: number; low: number; high: number };

export type ForecastResult = {
  points: ForecastPoint[];
  in12: number;
  expectedDrop: number;
  bestMonthToSell: { month: string; value: number };
};

export type ForecastArgs = {
  today: string;
  currentValue: number;
  modelYear: number;
  milesPerYear: number;
  /** 12 values, Jan..Dec. Defaults to config.defaultSeasonality. */
  seasonality?: readonly number[];
  config?: ForecastConfig;
  mileagePctPer1k?: number;
};

/** "2026-11-12" + 1 month -> "2026-12". */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

export function annualDepreciation(age: number, config: ForecastConfig = forecastConfig): number {
  for (const b of config.depreciationBands) if (age <= b.maxAge) return b.annualPct;
  return config.depreciationBands[config.depreciationBands.length - 1]!.annualPct;
}

export function bandPct(t: number, config: ForecastConfig = forecastConfig): number {
  return Math.min(config.bandMaxPct, config.bandBasePct * Math.sqrt(t));
}

export function forecastValue(args: ForecastArgs): ForecastResult {
  const config = args.config ?? forecastConfig;
  const S = args.seasonality ?? config.defaultSeasonality;
  if (S.length !== 12) throw new Error('seasonality needs 12 values');
  const pctPer1k = args.mileagePctPer1k ?? valuationConfig.mileagePctPer1k;
  const V0 = args.currentValue;
  const ym0 = args.today.slice(0, 7);
  const [y0, m0] = ym0.split('-').map(Number) as [number, number];
  const age0 = Math.max(0, y0 - args.modelYear + (m0 - 1) / 12);

  const points: ForecastPoint[] = [];
  let D = 1;
  for (let t = 1; t <= config.horizonMonths; t++) {
    const age = age0 + t / 12;
    D *= Math.pow(1 - annualDepreciation(age, config), 1 / 12);
    const month = addMonths(ym0, t);
    const mi = Number(month.slice(5, 7)) - 1;
    const seasonal = S[mi]! / S[m0 - 1]!;
    const extraMiles = ((args.milesPerYear - config.baselineMilesPerYear) * t) / 12;
    const mid = Math.max(0, V0 * D * seasonal - V0 * pctPer1k * (extraMiles / 1000));
    const h = bandPct(t, config);
    points.push({
      month,
      mid: roundTo(mid, config.roundTo),
      low: roundTo(mid * (1 - h), config.roundTo),
      high: roundTo(mid * (1 + h), config.roundTo),
    });
  }

  let best = 0;
  for (let i = 1; i < Math.min(config.bestMonthWindow, points.length); i++) if (points[i]!.mid > points[best]!.mid) best = i;
  const last = points[points.length - 1]!;
  return {
    points,
    in12: last.mid,
    expectedDrop: Math.max(0, V0 - last.mid),
    bestMonthToSell: { month: points[best]!.month, value: points[best]!.mid },
  };
}

/**
 * Seasonality from monthly medians ("YYYY-MM" -> median). Returns null unless at
 * least `minMonths` months exist and every calendar month is covered.
 */
export function seasonalityFromSeries(
  series: { month: string; median: number }[],
  config: ForecastConfig = forecastConfig,
): number[] | null {
  const pts = series.filter((p) => p.median > 0);
  if (pts.length < config.seasonalityMinMonths) return null;
  const xs = pts.map((p) => {
    const [y, m] = p.month.split('-').map(Number) as [number, number];
    return y * 12 + (m - 1);
  });
  const ys = pts.map((p) => Math.log(p.median));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const sums = new Array<number>(12).fill(0);
  const counts = new Array<number>(12).fill(0);
  for (let i = 0; i < n; i++) {
    const resid = ys[i]! - (my + slope * (xs[i]! - mx));
    const cm = xs[i]! % 12;
    sums[cm]! += resid;
    counts[cm]! += 1;
  }
  if (counts.some((c) => c === 0)) return null;
  const idx = sums.map((s, i) => Math.exp(s / counts[i]!));
  const mean = idx.reduce((a, b) => a + b, 0) / 12;
  return idx.map((v) => v / mean);
}

/** Miles per year from odometer readings (sorted or not). Null when the span is too short. */
export function observedMilesPerYear(
  readings: { miles: number; recordedOn: string }[],
  config: ForecastConfig = forecastConfig,
): number | null {
  if (readings.length < 2) return null;
  const s = [...readings].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
  const first = s[0]!;
  const last = s[s.length - 1]!;
  const days = (Date.parse(last.recordedOn) - Date.parse(first.recordedOn)) / 86_400_000;
  if (days < config.observedMinDays || last.miles < first.miles) return null;
  const rate = ((last.miles - first.miles) / days) * 365;
  return Math.min(config.maxMilesPerYear, Math.round(rate / 100) * 100);
}
