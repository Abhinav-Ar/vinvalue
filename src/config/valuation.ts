/**
 * Valuation knobs. Everything tunable lives here, not in the engine.
 * Dollar tables are starting points chosen to be conservative; revisit once
 * we have real MarketCheck data and sale outcomes.
 */
export const valuationConfig = {
  engineVersion: '1.0.0',
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
  /** Weight multiplier for comps of a different (but same model) year, and for trim mismatch. */
  otherYearWeight: 0.7,
  trimMismatchWeight: 0.5,
  /** Mileage adjustment: $ per mile vs comp weighted-average, as a fraction of base price per 1k miles. */
  mileagePctPer1k: 0.004,
  mileageAdjCapPct: 0.15,
  /** Regional demand: compares local median to the wide-radius median (see engine). Capped. */
  regionalCapPct: 0.05,
  /** Condition, title, accident, service history as fractions of base. Comps are assumed "good, clean, none". */
  condition: { excellent: 0.05, good: 0, fair: -0.08, rough: -0.2 },
  title: { clean: 0, rebuilt: -0.25, salvage: -0.45 },
  accidents: { none: 0, minor: -0.05, major: -0.15 },
  serviceHistory: { full: 0.02, partial: 0, none: -0.03 },
  owners: { 1: 0.01, 2: 0, 3: -0.02 },
  keys: { two: 0, one: -0.005 },
  warningLights: { none: 0, check_engine: -0.04, other: -0.02 },
  /** Instant and retail derived from private value. */
  spreads: { instant: -0.16, retail: 0.16 },
  /** Range half-width as a fraction, widened when comps are few or dispersed. */
  rangeBasePct: 0.06,
  rangeMaxPct: 0.15,
  /** Round displayed dollars to this step. */
  roundTo: 10,
  /** Anonymous appraisals are deleted after this many days unless saved. */
  anonymousRetentionDays: 90,
} as const;

export type ValuationConfig = typeof valuationConfig;
