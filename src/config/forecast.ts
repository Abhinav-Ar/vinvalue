/**
 * Value tracker forecast knobs. See src/lib/forecast/index.ts for the model.
 */
export const forecastConfig = {
  /**
   * Annual depreciation by vehicle age (years since model year). First band whose
   * maxAge >= age applies. Starting points from typical used-car curves.
   * TODO(data source): fit per segment from sale outcomes.
   */
  depreciationBands: [
    { maxAge: 1, annualPct: 0.15 },
    { maxAge: 3, annualPct: 0.12 },
    { maxAge: 6, annualPct: 0.1 },
    { maxAge: 10, annualPct: 0.08 },
    { maxAge: Infinity, annualPct: 0.06 },
  ],
  /**
   * National seasonality index by calendar month (Jan..Dec), mean ~1. Used when a
   * model has fewer than `seasonalityMinMonths` monthly market snapshots.
   * Shape: spring tax-refund peak, late-fall low.
   * TODO(data source): replace with a measured national used-price index.
   */
  defaultSeasonality: [0.99, 1.005, 1.02, 1.02, 1.01, 1.005, 1.0, 0.995, 0.99, 0.985, 0.98, 0.985],
  /** Months of snapshot medians needed before we trust a model-specific index. */
  seasonalityMinMonths: 12,
  /** Miles per year the depreciation curve already assumes. */
  baselineMilesPerYear: 12000,
  maxMilesPerYear: 60000,
  /** Odometer span needed before the observed rate is trusted. */
  observedMinDays: 30,
  /** Likely range half-width: bandBasePct x sqrt(months ahead), capped. */
  bandBasePct: 0.015,
  bandMaxPct: 0.12,
  horizonMonths: 12,
  bestMonthWindow: 6,
  roundTo: 10,
} as const;

export type ForecastConfig = typeof forecastConfig;
