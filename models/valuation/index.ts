import { committedCorrections, correctionFamily, correctionFactor, type Corrections } from './biasCorrections';
import type { DecodedSpecs, AppraisalInputs, ValueRange, Adjustment, CompStats, Confidence } from '@/models/db/schema';
import type { ValuationAudit } from '@/shared/valuation';
import { loadReferences, type ReferenceData } from '@/models/reference';
import { evaluateSurface, NotEnoughDataError, type Surface } from './surface';
import { normalizeSurfaceComps } from './normalizeComps';
import type { Listing } from '@/models/providers/types';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
import { AppError, TooFewCompsError } from '@/models/errors';
import { clamp, median, quantile, roundTo, weightedMedian } from '@/models/stats';
import { mileageFlags } from '@/models/vin-decode';

export type { ValueRange, Adjustment, CompStats, Confidence } from '@/models/db/schema';

/** Regional comparison needs at least this many local comps. TODO: move into valuationConfig. */
export const ENGINE_MIN_LOCAL_COMPS = 3;

export type TrimMatch = 'exact' | 'adjusted' | 'excluded';

export type ScoredComp = Listing & {
  weight: number;
  excludedAsOutlier: boolean;
  trimMatch: TrimMatch;
  /** Private-equivalent, trim-shifted price used in the math. */
  adjustedPrice: number;
  searchTier: number;
  /** True when this comp is in the base set (step 6) and not excluded. */
  usedInBase: boolean;
};

export type ValuationResult = {
  mode?: 'comps' | 'model';
  audit?: ValuationAudit;
  private: ValueRange;
  instant: ValueRange;
  retail: ValueRange;
  adjustments: Adjustment[];
  /** Every eligible listing, including outliers and trim-excluded comps. */
  comps: ScoredComp[];
  stats: CompStats & { searchTier: number; privateComps: number; dealerComps: number; duplicatesRemoved: number };
  confidence: Confidence;
  /** Plain-language notes for the report. */
  methodNotes: string[];
  methodVersion: string;
  /** Alias of methodVersion (older contract name). */
  engineVersion: string;
};

export type ComputeArgs = {
  specs: DecodedSpecs;
  inputs: AppraisalInputs;
  listings: Listing[];
  config?: ValuationConfig;
  references?: ReferenceData;
  corrections?: Corrections;
  /** Local search radius (default config.radiusMiles). */
  radiusMiles?: number;
  /** Search tier the listings came from (fetchCompsTiered). Inferred from distance/years when omitted. */
  searchTier?: number;
  /** Did the user pick the trim (vs. inferred / unknown)? Default: inputs.trim != null. */
  trimConfirmedByUser?: boolean;
  now?: Date;
};

const BODY_WORDS = /\b(coupe|sedan|convertible|hatchback|wagon|cabriolet|roadster|fastback|[2-5]d|[2-5]-door)\b/gi;

/** "GT Coupe" -> "gt"; "  XLE  Premium " -> "xle premium". */
export function normalizeTrim(t: string | null | undefined): string {
  if (!t) return '';
  return t.replace(BODY_WORDS, '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
}

export function trimsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeTrim(a) === normalizeTrim(b);
}

export function weightLabel(weight: number, cutoffs: { high: number; med: number } = valuationConfig.weightLabelCutoffs): 'High' | 'Med' | 'Low' {
  if (weight >= cutoffs.high) return 'High';
  if (weight >= cutoffs.med) return 'Med';
  return 'Low';
}

/** Step 1: drop certified inventory and same-VIN duplicates (keeps the closest). */
export function eligibleListings(listings: Listing[]): { listings: Listing[]; duplicatesRemoved: number; certifiedRemoved: number } {
  const notCert = listings.filter((l) => { const kind = (l.inventoryType ?? '').toLowerCase(); return kind !== 'certified' && kind !== 'new'; });
  const keyOf = (l: Listing) => (l.vin ? `v:${l.vin}` : l.id ? `i:${l.id}` : null);
  const best = new Map<string, Listing>();
  for (const l of notCert) {
    const key = keyOf(l);
    if (!key) continue;
    const prev = best.get(key);
    if (!prev || (l.distance ?? Infinity) < (prev.distance ?? Infinity)) best.set(key, l);
  }
  // Preserve input order for determinism.
  const out = notCert.filter((l) => {
    const key = keyOf(l);
    return !key || best.get(key) === l;
  });
  return { listings: out, duplicatesRemoved: notCert.length - out.length, certifiedRemoved: listings.length - notCert.length };
}

/**
 * Listings the engine could price before outlier removal: eligible ones, minus other-trim groups
 * that step 3 would exclude. Used by fetchCompsTiered to decide whether to widen the search.
 */
export function pricableCount(listings: Listing[], subjectTrim: string | null, config: ValuationConfig = valuationConfig): number {
  const ls = eligibleListings(listings).listings;
  if (!normalizeTrim(subjectTrim)) return ls.length;
  const groups = new Map<string, number>();
  let exact = 0;
  for (const l of ls) {
    if (trimsMatch(l.trim, subjectTrim)) exact++;
    else groups.set(normalizeTrim(l.trim), (groups.get(normalizeTrim(l.trim)) ?? 0) + 1);
  }
  if (exact < config.trimGapMinPerSide) return exact;
  let n = exact;
  for (const [k, c] of groups) if (k && c >= config.trimGapMinPerSide) n += c;
  return n;
}

/** Step 4 weight (trim factor applies only when trimMatch is 'adjusted'). */
export function compWeight(
  comp: Pick<Listing, 'miles' | 'year' | 'daysOnMarket'>,
  subject: { miles: number; year: number },
  trimMatch: TrimMatch = 'exact',
  config: ValuationConfig = valuationConfig,
): number {
  if (trimMatch === 'excluded') return 0;
  const d = Math.abs(comp.miles - subject.miles) / config.mileageWeightScale;
  let w = 1 / (1 + d * d);
  w *= config.otherYearWeight ** Math.abs(comp.year - subject.year);
  if (comp.daysOnMarket != null && comp.daysOnMarket >= config.staleDomDays) w *= config.staleWeight;
  if (trimMatch === 'adjusted') w *= config.trimAdjustedWeight;
  return w;
}

/** Marks outliers by the IQR fence. Returns a parallel boolean array. */
export function outlierFlags(prices: number[], k: number, minN: number = valuationConfig.minForOutliers): boolean[] {
  if (prices.length < minN) return prices.map(() => false);
  const q1 = quantile(prices, 0.25);
  const q3 = quantile(prices, 0.75);
  const lo = q1 - k * (q3 - q1);
  const hi = q3 + k * (q3 - q1);
  return prices.map((p) => p < lo || p > hi);
}

/** Weighted quantile (step function on cumulative weight). */
export function weightedQuantile(items: { value: number; weight: number }[], q: number): number {
  const xs = items.filter((i) => i.weight > 0).sort((a, b) => a.value - b.value);
  if (!xs.length) throw new Error('weightedQuantile of empty list');
  const total = xs.reduce((a, b) => a + b.weight, 0);
  let cum = 0;
  for (const x of xs) {
    cum += x.weight;
    if (cum >= q * total - 1e-9) return x.value;
  }
  return xs[xs.length - 1]!.value;
}

/** Weighted least-squares slope of y on x. Null when x has no variance. */
export function wlsSlope(points: { x: number; y: number; w: number }[]): number | null {
  const W = points.reduce((a, p) => a + p.w, 0);
  if (W <= 0) return null;
  const mx = points.reduce((a, p) => a + p.w * p.x, 0) / W;
  const my = points.reduce((a, p) => a + p.w * p.y, 0) / W;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += p.w * (p.x - mx) * (p.y - my);
    sxx += p.w * (p.x - mx) ** 2;
  }
  return sxx > 0 ? sxy / sxx : null;
}

const r10 = (n: number) => roundTo(n, 10) || 0; // `|| 0` avoids -0
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtUsd = (n: number) => `${n < 0 ? '-' : ''}$${fmtInt(Math.abs(n))}`;
const fmtPct = (f: number) => {
  const p = Math.abs(f * 100);
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
};

const ACCIDENT_LABEL = { none: 'none reported', minor: 'minor', major: 'major' } as const;
const SERVICE_LABEL = { full: 'full records', partial: 'partial records', none: 'no records' } as const;
const OWNERS_LABEL = { 1: '1 owner', 2: '2 owners', 3: '3 or more owners' } as const;
const KEYS_LABEL = { two: 'both sets', one: 'one set' } as const;
const LIGHTS_LABEL = { none: 'none', check_engine: 'check engine', other: 'other' } as const;

function pctReason(pct: number, what: string): string {
  if (pct === 0) return `${what} matches what typical listings assume, so no change.`;
  return `${what} ${pct > 0 ? 'adds' : 'takes off'} about ${fmtPct(pct)}% of the base value.`;
}

function inferTier(listings: Listing[], subjectYear: number, radius: number): number {
  let t = 1;
  for (const l of listings) {
    if (Math.abs(l.year - subjectYear) > 1) return 3;
    if ((l.distance ?? 0) > radius) t = 2;
  }
  return t;
}

export function computeLegacyValuation(args: ComputeArgs, normalized = false, surfaceWeights?: Map<string, number>): ValuationResult {
  const config = args.config ?? valuationConfig;
  const { specs, inputs } = args;
  const radius = args.radiusMiles ?? config.radiusMiles;
  const subjectTrim = normalizeTrim(inputs.trim) ? inputs.trim : null;
  const trimConfirmedByUser = args.trimConfirmedByUser ?? inputs.trim != null;

  // 1. Eligible listings.
  const elig = eligibleListings(args.listings);
  const listings = elig.listings;
  const tier = args.searchTier ?? inferTier(listings, specs.year, radius);

  // 2. Private-equivalent prices.
  const isPrivate = (l: Listing) => l.sellerType === 'private';
  const pe = listings.map((l) => (normalized || isPrivate(l) || l.inventoryType === 'public_record' ? l.price : l.price * (1 + config.dealerToPrivatePct)));

  // 3. Trim gap.
  const trimMatch: TrimMatch[] = listings.map(() => 'exact');
  const shift: number[] = listings.map(() => 0);
  const trimNotes: string[] = [];
  let sameCount = 0;
  if (subjectTrim && !normalized) {
    const same = listings.map((l, i) => (trimsMatch(l.trim, subjectTrim) ? pe[i]! : null)).filter((x): x is number => x != null);
    const groups = new Map<string, number[]>();
    listings.forEach((l, i) => {
      if (trimsMatch(l.trim, subjectTrim)) return;
      const k = normalizeTrim(l.trim);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(i);
    });
    sameCount = same.length;
    const sameMed = same.length >= config.trimGapMinPerSide ? median(same) : null;
    for (const [, idxs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const label = listings[idxs[0]!]!.trim ?? 'unknown trim';
      if (sameMed != null && idxs.length >= config.trimGapMinPerSide && normalizeTrim(label)) {
        const gap = median(idxs.map((i) => pe[i]!)) - sameMed;
        for (const i of idxs) { trimMatch[i] = 'adjusted'; shift[i] = -gap; }
        trimNotes.push(`${label} listings shifted by ${fmtUsd(-Math.round(gap))} to match ${subjectTrim}.`);
      } else {
        for (const i of idxs) trimMatch[i] = 'excluded';
        trimNotes.push(`${idxs.length} ${label} listing${idxs.length === 1 ? '' : 's'} left out: not enough data to price the trim difference.`);
      }
    }
  }
  const adjusted = listings.map((_, i) => Math.round(pe[i]! + shift[i]!));

  // 4 + 5. Weights and outliers (among non-excluded comps).
  const candIdx = listings.map((_, i) => i).filter((i) => trimMatch[i] !== 'excluded');
  const candFlags = outlierFlags(candIdx.map((i) => adjusted[i]!), config.iqrK, config.minForOutliers);
  const outlier = listings.map(() => false);
  candIdx.forEach((i, j) => { outlier[i] = candFlags[j]!; });
  const subject = { miles: inputs.mileage, year: specs.year };
  const comps: ScoredComp[] = listings.map((l, i) => ({
    ...l,
    weight: surfaceWeights?.get(l.id) ?? compWeight(l, subject, trimMatch[i], config),
    excludedAsOutlier: outlier[i]!,
    trimMatch: trimMatch[i]!,
    adjustedPrice: adjusted[i]!,
    searchTier: tier,
    usedInBase: false,
  }));
  const used = comps.filter((c) => c.trimMatch !== 'excluded' && !c.excludedAsOutlier && c.weight > 0);
  if (used.length < config.minComps) {
    // The trim the user picked does not appear in any listing (e.g. "Shelby GT500" on a GT VIN): say so
    // and offer the trims we did see, instead of a misleading "only 0 comparable listings".
    if (subjectTrim && sameCount === 0 && listings.length > 0) {
      const seen = new Map<string, { label: string; n: number }>();
      for (const l of listings) {
        const k = normalizeTrim(l.trim);
        if (!k) continue;
        const e = seen.get(k) ?? { label: l.trim!.trim(), n: 0 };
        e.n++;
        seen.set(k, e);
      }
      const trimCandidates = [...seen.values()].sort((a, b) => b.n - a.n).map((e) => e.label);
      throw new AppError(
        400,
        'invalid_input',
        `We found no ${subjectTrim} listings to compare against. Check the trim.`,
        { trim: ['No listings for this trim.'] },
        { trimCandidates },
      );
    }
    throw new TooFewCompsError(used.length, config.minComps);
  }

  // 6. Base set and base.
  const privateUsed = used.filter(isPrivate);
  const privateMode = privateUsed.length >= config.minPrivateComps;
  const baseSet = privateMode ? privateUsed : used;
  for (const c of baseSet) c.usedInBase = true;
  const wv = baseSet.map((c) => ({ value: c.adjustedPrice, weight: c.weight }));
  const base = r10(weightedMedian(wv));
  const totalW = baseSet.reduce((a, c) => a + c.weight, 0);
  const avgMiles = Math.round(baseSet.reduce((a, c) => a + c.miles * c.weight, 0) / totalW);

  // 7. Adjustments.
  const adjustments: Adjustment[] = [];
  if (!normalized) {
    const miles = used.map((c) => c.miles);
    const spread = Math.max(...miles) - Math.min(...miles);
    const slope = wlsSlope(used.map((c) => ({ x: c.miles, y: c.adjustedPrice, w: c.weight })));
    const fitOk = used.length >= config.mileageFitMinComps && spread >= config.mileageFitMinSpreadMiles && slope != null && slope < 0;
    const dMiles = inputs.mileage - avgMiles;
    const raw = fitOk ? slope! * dMiles : -base * config.mileagePctPer1k * (dMiles / 1000);
    const cap = base * config.mileageAdjCapPct;
    const amount = r10(clamp(raw, -cap, cap));
    const how = fitOk
      ? `fitted from ${used.length} comparable listings (about ${fmtUsd(Math.round(-slope! * 1000))} per 1,000 miles)`
      : `standard rate of ${fmtPct(config.mileagePctPer1k)}% of value per 1,000 miles (not enough mileage spread to fit one)`;
    adjustments.push({
      key: 'mileage',
      label: `Mileage, ${fmtInt(inputs.mileage)} vs ${fmtInt(avgMiles)} average`,
      amount,
      reason:
        amount === 0
          ? 'Your mileage is close to the average of comparable listings.'
          : `${fmtInt(Math.abs(dMiles))} miles ${dMiles < 0 ? 'fewer' : 'more'} than comparable listings, using a rate ${how}${Math.abs(raw) > cap ? '; capped' : ''}.`,
    });
  }
  {
    let amount = 0;
    let reason = 'Comps are local, so local demand is already in the price.';
    if (tier >= 2) {
      const local = baseSet.filter((c) => c.distance != null && c.distance <= radius);
      if (local.length >= ENGINE_MIN_LOCAL_COMPS) {
        const localMed = median(local.map((c) => c.adjustedPrice));
        const areaMed = median(baseSet.map((c) => c.adjustedPrice));
        const pct = clamp(localMed / areaMed - 1, -config.regionalCapPct, config.regionalCapPct);
        amount = r10(base * pct);
        reason = `Listings within ${radius} miles price ${pct >= 0 ? 'above' : 'below'} the wider ${config.widenedRadiusMiles}-mile area by about ${fmtPct(pct)}%${Math.abs(localMed / areaMed - 1) > config.regionalCapPct ? ' (capped)' : ''}.`;
      } else {
        reason = `The search widened to ${config.widenedRadiusMiles} miles and too few listings are local to compare.`;
      }
    }
    adjustments.push({ key: 'regional', label: `Regional demand, ${inputs.zip}`, amount, reason });
  }

  adjustments.push(...historyAdjustments(base, inputs, config));

  // 8. Private value.
  const sum = adjustments.reduce((a, x) => a + x.amount, 0);
  const privateValue = roundTo(Math.max(base + sum, base * config.floorPct), config.roundTo);

  // 9. Range.
  const wMed = weightedMedian(wv);
  const wIqr = baseSet.length >= 2 ? weightedQuantile(wv, 0.75) - weightedQuantile(wv, 0.25) : 0;
  let half = wMed > 0 ? wIqr / 2 / wMed : 0;
  const rangeReasons: string[] = [];
  const widen = (pct: number, reason: string) => {
    if (pct > 0) { half += pct; rangeReasons.push(reason); }
  };
  if (used.length < config.fullConfidenceComps) widen(config.rangeFewCompsPct, `Only ${used.length} comparable listings were usable.`);
  widen(config.tierRangePct[tier] ?? 0, tier >= 3
    ? `Search widened to ${config.widenedRadiusMiles} miles and model years within 2 of yours.`
    : `Search widened to ${config.widenedRadiusMiles} miles.`);
  if (!trimConfirmedByUser) widen(config.rangeUnconfirmedTrimPct, 'Trim not confirmed.');
  widen(config.rangeSelfReportedConditionPct, 'Condition is self-reported.');
  widen(config.rangeNoTitleDataPct, 'Title and accident history are not verified by a history report.');
  half = clamp(half, config.rangeMinPct, config.rangeMaxPct);
  const range = (center: number, factor: number): ValueRange => ({
    value: roundTo(center * factor, config.roundTo),
    low: roundTo(center * (1 - half) * factor, config.roundTo),
    high: roundTo(center * (1 + half) * factor, config.roundTo),
  });

  // Confidence + notes.
  const selfReported = ['condition', 'accidents', 'title'];
  if (inputs.owners) selfReported.push('owners');
  if (inputs.keys) selfReported.push('keys');
  if (inputs.warningLights) selfReported.push('warningLights');
  if (inputs.serviceHistory) selfReported.push('serviceHistory');
  const confidence: Confidence = {
    decodeStatus: specs.decodeStatus ?? (specs.checkDigitValid ? 'clean' : 'check_digit_mismatch'),
    trimConfirmedByUser,
    selfReported,
    flags: mileageFlags(inputs.mileage, specs.year, config.highMilesPerYear, args.now),
    rangeReasons,
    searchTier: tier,
  };
  const excluded = comps.filter((c) => c.excludedAsOutlier).length;
  const methodNotes: string[] = [];
  if (excluded) methodNotes.push(`${excluded} listing${excluded === 1 ? '' : 's'} removed as price outliers.`);
  if (elig.duplicatesRemoved) methodNotes.push(`${elig.duplicatesRemoved} duplicate listing${elig.duplicatesRemoved === 1 ? '' : 's'} of the same car removed.`);
  methodNotes.push(
    privateMode
      ? `Private sale value based on ${privateUsed.length} private-seller listings.`
      : `Too few private-seller listings, so dealer asking prices were converted to private-sale equivalents (${fmtPct(config.dealerToPrivatePct)}% less).`,
  );
  methodNotes.push(...trimNotes);
  methodNotes.push('Comps weighted by mileage closeness, model year and listing age.');
  methodNotes.push('Instant and retail values use typical spreads in your area.');
  methodNotes.push("Not an offer. A buyer's inspection decides.");

  return {
    private: range(privateValue, 1),
    instant: range(privateValue, 1 + config.spreads.instant),
    retail: range(privateValue, 1 + config.spreads.retail),
    adjustments,
    comps,
    stats: {
      found: comps.length,
      used: used.length,
      excluded,
      median: r10(median(baseSet.map((c) => c.adjustedPrice))),
      weightedMedian: base,
      avgMiles,
      radiusMiles: tier >= 2 ? config.widenedRadiusMiles : radius,
      searchTier: tier,
      privateComps: privateUsed.length,
      dealerComps: used.length - privateUsed.length,
      duplicatesRemoved: elig.duplicatesRemoved,
    },
    confidence,
    methodNotes,
    methodVersion: normalized ? config.methodVersion : '1.2.0',
    engineVersion: normalized ? config.methodVersion : '1.2.0',
  };
}

function cap1(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function historyAdjustments(base: number, inputs: AppraisalInputs, config: ValuationConfig): Adjustment[] {
  const adjustments: Adjustment[] = [];
  const pctLine = (key: string, label: string, pct: number, what: string) =>
    adjustments.push({ key, label, amount: r10(base * pct), reason: pctReason(pct, what) });
  pctLine('condition', `Condition, ${inputs.condition}`, config.condition[inputs.condition], `${cap1(inputs.condition)} condition (as you reported)`);
  pctLine('accidents', `Accident history, ${ACCIDENT_LABEL[inputs.accidents]}`, config.accidents[inputs.accidents], inputs.accidents === 'none' ? 'No reported accidents' : `A ${inputs.accidents} accident`);
  pctLine('title', `Title, ${inputs.title}`, config.title[inputs.title], `A ${inputs.title} title`);
  if (inputs.serviceHistory) pctLine('serviceHistory', `Service history, ${SERVICE_LABEL[inputs.serviceHistory]}`, config.serviceHistory[inputs.serviceHistory], `Service history with ${SERVICE_LABEL[inputs.serviceHistory]}`);
  if (inputs.owners) pctLine('owners', `Owners, ${OWNERS_LABEL[inputs.owners]}`, config.owners[inputs.owners], cap1(OWNERS_LABEL[inputs.owners]));
  if (inputs.keys) pctLine('keys', `Keys, ${KEYS_LABEL[inputs.keys]}`, config.keys[inputs.keys], inputs.keys === 'two' ? 'Both key sets' : 'A missing key set');
  if (inputs.warningLights) pctLine('warningLights', `Warning lights, ${LIGHTS_LABEL[inputs.warningLights]}`, config.warningLights[inputs.warningLights], inputs.warningLights === 'none' ? 'No warning lights' : `A ${LIGHTS_LABEL[inputs.warningLights]} light`);

  return adjustments;
}

export function computeValuation(args: ComputeArgs): ValuationResult {
  const config = args.config ?? valuationConfig, data = args.references ?? loadReferences(), now = args.now ?? new Date();
  let subject: Surface;
  try { subject = evaluateSurface(args.specs, args.inputs.trim, args.inputs.mileage, now, data, config); }
  catch (e) {
    if (!(e instanceof NotEnoughDataError)) throw e;
    // Replay the explicitly versioned legacy comp method only when no reference surface exists.
    // Missing anchors must never produce a model dollar guess.
    try { return computeLegacyValuation(args); }
    catch (err) { if (err instanceof TooFewCompsError) throw e; throw err; }
  }
  const normalized = normalizeSurfaceComps(args, subject, data, now, config);
  let result: ValuationResult | null = null;
  if (normalized.listings.length >= config.minComps) {
    try {
      result = computeLegacyValuation({ ...args, listings: normalized.listings, inputs: { ...args.inputs, trim: null } }, true, normalized.weights);
      result.comps.forEach(c => { const original = args.listings.find(l => l.id === c.id); if (original) { c.price = original.price; c.trim = original.trim; } c.trimMatch = normalized.matches.get(c.id) ?? 'adjusted'; });
    } catch (e) { if (!(e instanceof TooFewCompsError)) throw e; }
  }
  const model = !result, p = config.surface;
  const snapshot=args.corrections??committedCorrections;
  const correction=model?correctionFactor(snapshot,subject.segment,correctionFamily(subject.msrpRow!)):1;
  const base = result?.stats.weightedMedian ?? subject.H*correction;
  const adjustments = result?.adjustments ?? historyAdjustments(base, args.inputs, config);
  const value = result?.private.value ?? roundTo(Math.max(base+adjustments.reduce((a,x) => a+x.amount,0),base*config.floorPct),config.roundTo);
  const comps = result?.comps ?? [];
  const used = comps.filter(c => c.usedInBase);
  const sumW = used.reduce((a,c) => a+c.weight,0), sumW2 = used.reduce((a,c) => a+c.weight*c.weight,0);
  const nEff = sumW2 ? sumW*sumW/sumW2 : 0;
  const legacyHalf = result ? result.private.high/result.private.value-1 : 0;
  // Comps mode: unknown-trim comps (e.g. WA recorded sales) widen once, in proportion to their share; they are
  // not also charged the known-trim contrast prior. The MSRP anchor cancels in same-generation H_s/H_c ratios,
  // so its uncertainty belongs to model mode only.
  const unknownIds = new Set(normalized.audit.filter(a=>a.reason?.startsWith('unknown trim')).map(a=>a.id));
  const unknownShare = used.length ? used.filter(c=>unknownIds.has(c.id)).length/used.length : 0;
  const knownAdjustedShare = used.length ? used.filter(c=>c.trimMatch==='adjusted' && !unknownIds.has(c.id)).length/used.length : 0;
  const unknownTrimLog = p.unknownTrimLog*unknownShare;
  const compsUncertainty = subject.uncertainty - p.anchorLog*({ documented: 0, inferred: .4, approximate: 1 } as const)[subject.msrpRow!.confidence];
  const rawWidth = model ? (config.segmentCalibration[subject.segment]?.interval ?? p.modelLogBase)+subject.modelUncertainty : Math.log1p(legacyHalf)+compsUncertainty+unknownTrimLog+(nEff<8 ? p.weakEffectiveLog : 0)+p.priorContrastLog*knownAdjustedShare;
  if (model && rawWidth > p.modelLogMax) throw new NotEnoughDataError('uncertainty exceeds the supported range; confirm the vehicle specification.');
  const hLog = clamp(rawWidth,model ? p.modelLogMin : p.compsLogMin,model ? p.modelLogMax : p.compsLogMax);
  const range = (factor:number): ValueRange => ({ value: roundTo(value*factor,config.roundTo), low: roundTo(value*factor*Math.exp(-hLog),config.roundTo), high: roundTo(value*factor*Math.exp(hLog),config.roundTo) });
  const notes = model ? ['Model estimate (no local sales data)', 'Original MSRP adjusted for inflation, retention and mileage; calibrated to approximate market references (and real WA EV sales for EVs).'] : ['Sales normalized by subject/comp value-surface ratios. No separate mileage, trim or collector uplift is added.'];
  if(model) notes.push(`Market correction: ${correction.toFixed(4)}× for ${subject.segment}; snapshot ${snapshot.fittedAt} (family holdout guarded; dealer asks converted to private equivalents).`);
  if (subject.msrpRow?.confidence === "approximate") notes.push("Original MSRP is approximate (best-knowledge figure, not from a cited source); the range is widened to reflect it.");
  notes.push("Not an offer. A buyer's inspection decides.");
  const audit: ValuationAudit = { references:{msrp:subject.msrpRow,generation:subject.generationRef,variant:subject.variantRef},parameters:{surface:p,retention:config.retentionPriors,segments:config.segmentCalibration,brands:config.brandCalibration,overrides:config.generationCurvePriors},mode: model ? 'model' : 'comps', asOf: now.toISOString(), parameterVersion:p.parameterVersion, referenceVintage:subject.cpiVintage,score:subject.D,coverage:subject.q,factors:subject.factors,notes,anchor:subject.M,retention:subject.R,mileageFactor:Math.exp(subject.L),base:roundTo(base,config.roundTo),hLog,effectiveComps:nEff,normalizations:normalized.audit };
  const confidence: Confidence & { valuation: ValuationAudit } = { decodeStatus:args.specs.decodeStatus ?? 'clean',trimConfirmedByUser:args.trimConfirmedByUser ?? !!args.inputs.trim,selfReported:['condition','title','accidents'],flags:[...(model ? ['model_estimate','approximate_reference_calibration'] : []),...(subject.caps ? ['surface_cap'] : [])],rangeReasons:[...notes,...subject.factors],searchTier:model ? 0 : result!.stats.searchTier,valuation:audit };
  return { mode:audit.mode,audit,private:range(1),instant:range(1+config.spreads.instant),retail:range(1+config.spreads.retail),adjustments,comps,stats:result?.stats ?? { found:0,used:0,excluded:0,median:0,weightedMedian:0,avgMiles:args.inputs.mileage,radiusMiles:0,searchTier:0,privateComps:0,dealerComps:0,duplicatesRemoved:0 },confidence,methodNotes:notes,methodVersion:config.methodVersion,engineVersion:config.methodVersion };
}
