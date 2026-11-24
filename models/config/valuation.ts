import { familySegments } from './familySegments';
/**
 * Valuation knobs. Everything tunable lives here, not in the engine.
 * Model centers use approximate references and local WA EV sales; legacy
 * comp adjustments and route spreads remain assumptions.
 */
export const valuationConfig = {
  methodVersion: '2.3.1',
  /** Calibrated 2026-11-17: 269/271 usable approximate references and 2026 WA EV medians.
   * 50/50 family split: refs holdout median/p80/p90 APE 16.4/32.7/46.4%;
   * WA EV cells 18.7/48.0/82.2%. Fullsize has no labels: retains neutral defaults.
   * Reproduce: scripts/reference/calibration/fit.ts; details in results.json and REPORT.md.
   * These labels do not identify separate age/period/cohort effects.
   */
  surface: {
    parameterVersion: '2026-11-17-family-holdout',
    scarcity: [{max:1000,score:1},{max:5000,score:.75},{max:20000,score:.5}],
    scarcityDemandMin: .6,
    /** Residual paint/options stay zero: fixed schema supplies no validated coefficients. */
    residualOptionLog: 0,
    weights: { E: .25, P: .20, L: .15, I: .20, T: .10, B: .05, H: .05 },
    f: .12, fD: .04, k: .14, kD: .06, floor: .12, floorD2: 0.5301,
    onset: 29.766, onsetD: 17.056, growth: .03, growthThreshold: .60,
    plateauCoverage: .75, growthCap: 2, retentionCap: 3,
    milesPerYear: 12000, milesD: .75, milesAgeCap: 15,
    beta: 0.2414, betaD2: 0.8, eta: .20, etaAge: 10,
    milesOffset: 10000, lowMilesThreshold: 40000, mileageCap: 1.35, collectorMileageCap: 2.5,
    normalizationCap: 1.3, performanceNormalizationCap: 2, performanceThreshold: .4,
    unknownTrimWeight: .35, unknownTrimLog: .10,
    residualMaxLambda: .8, residualOffset: 9, overlapMin: .5,
    // Baseline widths already include approximate-anchor error; small extra evidence penalties remain.
    modelLogBase: .20, modelLogD: .15, coverageLog: .10, anchorLog: .12,
    modelCoverageLog: .005, modelAnchorLog: .015,
    unvalidatedLog: .10, unknownTransmissionLog: .05, unknownOdometerLog: .05,
    unknownOriginalityLog: .08, capLog: .08, extrapAge: 35, extrapLog: .02,
    modelLogMin: 0, modelLogMax: .90, compsLogMin: .05, compsLogMax: .70,
    weakEffectiveLog: .03, priorContrastLog: .10,
  },
  /** Legacy calibration proposal defaults, retained for the older sales adapter. */
  calibration: { minTrainingRows:20, trainingFraction:.8, kMultipliers:[.65,.8,1,1.2,1.4], floorMultipliers:[.75,1,1.25,1.5,2] },
  /** Canonical family classification takes precedence over generation segments. */
  familySegments,
  segmentCalibration: {
  "economy": {
    "market": 1.3094,
    "k": 0.9246,
    "floor": 0.535,
    "interval": 0.19335516015890222
  },
  "midsize": {
    "market": 1.0884,
    "k": 0.8782,
    "floor": 0.8075,
    "interval": 0.20171512605020883
  },
  "fullsize": {
    "market": 1,
    "k": 1,
    "floor": 1,
    "interval": 0.3764232476777453
  },
  "suv": {
    "market": 1.3302,
    "k": 0.94925,
    "floor": 0.715,
    "interval": 0.3190541739125425
  },
  "truck": {
    "market": 1.1989,
    "k": 0.8637,
    "floor": 1.08,
    "interval": 0.29876847889320624
  },
  "van": {
    "market": 0.9701,
    "k": 0.8666,
    "floor": 0.6575,
    "interval": 0.29227605789924366
  },
  "luxury": {
    "market": 1.1144,
    "k": 1.0928,
    "floor": 1.4475,
    "interval": 0.3764232476777453
  },
  "sports": {
    "market": 1.6695,
    "k": 1.5655,
    "floor": 0.5,
    "interval": 0.489961513961377
  },
  "ev": {
    "market": 1.1508,
    "k": 1.37845,
    "floor": 0.5,
    "interval": 0.40811327833254313
  }
} as Record<string, { market: number; k: number; floor: number; interval: number }>,
  brandCalibration: {
  "acura": 0.6575,
  "audi": 0.8215,
  "bmw": 1.25725,
  "chevrolet": 1.18375,
  "dodge": 1.2805,
  "ford": 1.102,
  "gmc": 1.04725,
  "honda": 0.94375,
  "hyundai": 1.04425,
  "jeep": 1.045,
  "kia": 0.98425,
  "land rover": 1.18675,
  "lexus": 1.0045,
  "lincoln": 0.75475,
  "mazda": 0.94225,
  "mercedes-benz": 1.13875,
  "nissan": 1.021,
  "porsche": 1.07875,
  "tesla": 0.95725,
  "toyota": 0.86875,
  "volkswagen": 0.96625
} as Record<string, number>,
  retentionPriors: [
    { make: 'toyota', segment: 'midsize', kMultiplier: .65, floorMultiplier: 1.5 },
    { make: 'honda', segment: 'midsize', kMultiplier: .72, floorMultiplier: 1.4 },
    { make: 'lexus', segment: 'luxury', kMultiplier: .78, floorMultiplier: 1.4 },
    { make: 'toyota', segment: 'suv', kMultiplier: .72, floorMultiplier: 1.5 },
    { make: 'toyota', segment: 'truck', kMultiplier: .65, floorMultiplier: 1.6 },
  ],
  /** Only honored with G=1 and source evidence. No production appreciation overrides yet.
   * Key: lower-case make/model/generation. Allows exceptional onset retention and growth
   * without loosening conservative defaults or changing the fixed reference schema. */
  generationCurvePriors: {} as Record<string, { onset?: number; onsetRetention?: number; growthCap?: number; retentionCap?: number; growth?: number; sourceUrls: string[] }>,
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
  backtestMinCoverage: .8,
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

type Widen<T> = T extends string ? string : T extends number ? number : T extends readonly (infer U)[] ? readonly Widen<U>[] : T extends object ? { [K in keyof T]: Widen<T[K]> } : T;
export type ValuationConfig = Widen<typeof valuationConfig>;
