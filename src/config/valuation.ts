/**
 * Valuation knobs. Everything tunable lives here, not in the engine.
 * Dollar tables are starting points chosen to be conservative; revisit once
 * we have real MarketCheck data and sale outcomes.
 */
export const valuationConfig = {
  methodVersion: '1.1.0',
  /** Comps search. */
  radiusMiles: Number(process.env.VALUATION_RADIUS_MILES ?? 100),
  yearSpread: 1,
  /** Listings pulled per appraisal (paged 50 at a time; each page is one MarketCheck call). */
  maxComps: 100,
  /** Below this many usable comps (after outlier removal) we return too_few_comps. */
  minComps: Number(process.env.VALUATION_MIN_COMPS ?? 8),
  /** Outlier fence multiplier on IQR. */
  iqrK: 1.5,
  /** Mileage-closeness weight: w = 1 / (1 + (|dMiles| / scale)^2). */
  mileageWeightScale: 15000,
  /** Weight multiplier for comps of a different (but same model) year. */
  otherYearWeight: 0.7,
  /**
   * Trim handling: comps of another trim are price-shifted by the trim gap (median price difference
   * between the two trims among the comps, when each side has >= trimGapMinPerSide listings) and get
   * trimAdjustedWeight. Without enough data for a gap they are excluded (trimMatch = 'excluded').
   */
  trimGapMinPerSide: 3,
  trimAdjustedWeight: 0.6,
  /**
   * Asking price is not sale price. Dealer asks carry reconditioning and margin. Private value uses
   * private-seller comps when there are >= minPrivateComps; otherwise dealer asks are converted to
   * private-sale equivalents by dealerToPrivatePct. Starting assumption (open decision), calibrate
   * with sale_outcomes.
   */
  minPrivateComps: 5,
  dealerToPrivatePct: -0.1,
  /** Stale listings ask more than the market pays. */
  staleDomDays: 90,
  staleWeight: 0.5,
  /**
   * Search widening when comps are thin. Tier 1 = year +-1 within radiusMiles; tier 2 = year +-1 within
   * widenedRadiusMiles; tier 3 = year +-2 within widenedRadiusMiles. Each tier widens the range.
   */
  widenedRadiusMiles: 250,
  tierRangePct: { 1: 0, 2: 0.02, 3: 0.04 } as Record<number, number>,
  /**
   * Mileage adjustment = fitted price-vs-miles slope on the comps (weighted least squares) x
   * (subject miles - weighted average comp miles). Falls back to mileagePctPer1k of base per 1k miles
   * when the fit is unreliable (too few comps, too little mileage spread, or a non-negative slope).
   */
  mileageFitMinComps: 8,
  mileageFitMinSpreadMiles: 10000,
  mileagePctPer1k: 0.004,
  mileageAdjCapPct: 0.15,
  /** Flag odometer readings far above typical use for the car's age. */
  highMilesPerYear: 25000,
  /**
   * Regional demand is applied ONLY when the search widened beyond the local radius (tier >= 2):
   * local-radius comps' median vs the widened-area median, capped. Tier 1 comps already price local demand.
   */
  regionalCapPct: 0.05,
  /**
   * Documented assumptions (listings rarely state condition), as fractions of base. Comps are assumed
   * "good condition, clean title, no reported accidents". Rationale: excellent ~ reconditioning a buyer
   * avoids; fair/rough ~ typical repair cost plus risk discount; rebuilt/salvage ~ financing and
   * insurance limits; accidents ~ history-report stigma at resale. Calibrate with sale_outcomes.
   */
  condition: { excellent: 0.05, good: 0, fair: -0.08, rough: -0.2 },
  title: { clean: 0, rebuilt: -0.25, salvage: -0.45 },
  accidents: { none: 0, minor: -0.05, major: -0.15 },
  serviceHistory: { full: 0.02, partial: 0, none: -0.03 },
  owners: { 1: 0.01, 2: 0, 3: -0.02 },
  keys: { two: 0, one: -0.005 },
  warningLights: { none: 0, check_engine: -0.04, other: -0.02 },
  /** Instant and retail derived from private value. */
  spreads: { instant: -0.16, retail: 0.16 },
  /**
   * Range half-width = (weighted IQR of adjusted comp prices / 2) / weighted median, then widened for
   * few comps, search tier and unverified inputs; clamped to [rangeMinPct, rangeMaxPct].
   */
  rangeMinPct: 0.03,
  rangeMaxPct: 0.18,
  rangeFewCompsPct: 0.02,
  rangeUnconfirmedTrimPct: 0.02,
  rangeSelfReportedConditionPct: 0.01,
  rangeNoTitleDataPct: 0.01,
  /** Leave-one-out backtest gate: median absolute % error on fixtures must stay under this. */
  backtestMaxMedianApePct: 12,
  /** Private value never drops below this fraction of base, whatever the adjustments. */
  floorPct: 0.1,
  /** Outlier filtering needs at least this many comps to compute a meaningful IQR. */
  minForOutliers: 4,
  /** Comps at or above this count get no few-comps range widening. */
  fullConfidenceComps: 20,
  /** Report "Weight" column: relative weight >= high -> High, >= med -> Med, else Low. */
  weightLabelCutoffs: { high: 0.75, med: 0.4 },
  /** Round displayed dollars to this step. */
  roundTo: 10,
  /** Anonymous appraisals are deleted after this many days unless saved. */
  anonymousRetentionDays: 90,
} as const;

export type ValuationConfig = typeof valuationConfig;
