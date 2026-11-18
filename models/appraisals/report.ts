/** Report JSON (shape of design/Report.dc.html), built from stored rows. */
import type { Adjustment, CompStats, Confidence, ValueRange } from '@/models/db/schema';
import type { appraisals, comps } from '@/models/db/schema';
import { valuationConfig } from '@/models/config/valuation';
import type { ValuationAudit } from '@/shared/valuation';
import { weightLabel } from '@/models/valuation';

type AppraisalRow = Omit<typeof appraisals.$inferSelect, 'enrichment'> & { enrichment?: typeof appraisals.$inferSelect.enrichment };
type CompRow = typeof comps.$inferSelect;

export type ReportComp = {
  year: number;
  trim: string | null;
  miles: number;
  distance: number | null;
  /** Asking price as listed. */
  price: number;
  /** Private-equivalent, trim-shifted price used in the math. */
  adjustedPrice: number | null;
  trimMatch: string;
  weight: number;
  weightLabel: 'High' | 'Med' | 'Low';
  excludedAsOutlier: boolean;
  sellerType: string | null;
  daysOnMarket: number | null;
  title: string | null; dealerName: string | null; dealerCity: string | null; vdpUrl: string | null; photos: string[];
};

/** Safe to serve publicly: no user, vehicle or appraisal ids. */
export type PublicReport = {
  slug: string;
  /** "AQ-10D"; null for anonymous (unsaved) reports. */
  code: string | null;
  /** YYYY-MM-DD */
  date: string;
  saved: boolean;
  /** YYYY-MM-DD; null once saved. */
  expiresOn: string | null;
  vehicle: {
    label: string; year: number; make: string; model: string; trim: string | null;
    body: string | null; drive: string | null; engine: string | null; fuel: string | null;
  };
  vin: string;
  mileage: number;
  zip: string;
  route: AppraisalRow['route'];
  private: ValueRange;
  instant: ValueRange;
  retail: ValueRange;
  /** Starting point of the adjustment ladder. */
  base: { label: string; amount: number };
  adjustments: Adjustment[];
  comps: ReportComp[];
  compStats: CompStats & { summary: string };
  confidence: Confidence | null;
  methodNotes: string[];
  methodVersion: string;
  enrichment?: { fetchedAt?: string; safety?: unknown; marketStats?: unknown; prediction?: unknown; failures?: string[] } | null;
};

/** Returned to the owner (POST /api/appraisals, refresh). Includes the appraisal id for "Save to garage". */
export type AppraisalReport = PublicReport & { id: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Method notes regenerated from stored stats and comps (the engine wording, minus per-trim dollar detail). */
function methodNotes(s: CompStats, rows: CompRow[]): string[] {
  const notes: string[] = [];
  if (s.excluded > 0) notes.push(`${plural(s.excluded, 'listing')} removed as price outliers.`);
  if (s.duplicatesRemoved) notes.push(`${plural(s.duplicatesRemoved, 'duplicate listing')} of the same car removed.`);
  if (s.privateComps != null) {
    notes.push(
      s.privateComps >= valuationConfig.minPrivateComps
        ? `Private sale value based on ${plural(s.privateComps, 'private-seller listing')}.`
        : `Too few private-seller listings, so dealer asking prices were converted to private-sale equivalents (${Math.abs(valuationConfig.dealerToPrivatePct * 100)}% less).`,
    );
  }
  const adjusted = rows.filter((r) => r.trimMatch === 'adjusted').length;
  const excludedTrim = rows.filter((r) => r.trimMatch === 'excluded').length;
  if (adjusted) notes.push(`${plural(adjusted, 'listing')} of other trims price-shifted by the typical trim difference.`);
  if (excludedTrim) notes.push(`${plural(excludedTrim, 'listing')} of other trims left out: not enough data to price the difference.`);
  notes.push('Comps weighted by mileage closeness, model year and listing age.');
  notes.push('Instant and retail values use typical spreads in your area.');
  notes.push("Not an offer. A buyer's inspection decides.");
  return notes;
}

/** Comps behind the base: the private-seller subset in private mode, else all used comps. */
const baseCount = (s: CompStats) => (s.privateComps != null && s.privateComps >= valuationConfig.minPrivateComps ? s.privateComps : s.used);

export function buildReport(a: AppraisalRow, rows: CompRow[], code: string | null): AppraisalReport {
  const s = a.compStats;
  const audit = (a.confidence as (Confidence & { valuation?: ValuationAudit }) | null)?.valuation;
  const trim = a.inputs.trim;
  const label = [a.specs.year, a.specs.make, a.specs.model, trim].filter(Boolean).join(' ');
  const reportComps: ReportComp[] = rows
    .map((c) => ({
      year: c.year,
      trim: c.trim,
      miles: c.miles,
      distance: c.distanceMiles != null ? Math.round(c.distanceMiles) : null,
      price: c.price,
      adjustedPrice: c.adjustedPrice,
      trimMatch: c.trimMatch,
      weight: c.weight,
      weightLabel: weightLabel(c.weight),
      excludedAsOutlier: c.excludedAsOutlier,
      sellerType: c.sellerType,
      daysOnMarket: c.daysOnMarket,
      title: c.title, dealerName: c.dealerName, dealerCity: c.dealerCity, vdpUrl: /^https:\/\//.test(c.vdpUrl ?? '') ? c.vdpUrl : null, photos: Array.isArray(c.photos) ? c.photos.slice(0,16) : [],
    }))
    .sort((x, y) =>
      Number(x.excludedAsOutlier || x.trimMatch === 'excluded') - Number(y.excludedAsOutlier || y.trimMatch === 'excluded') ||
      y.weight - x.weight || (x.distance ?? 0) - (y.distance ?? 0) || x.price - y.price);

  return {
    id: a.id,
    slug: a.shareSlug,
    code,
    date: a.createdAt.toISOString().slice(0, 10),
    saved: a.userId != null,
    expiresOn: a.expiresAt ? a.expiresAt.toISOString().slice(0, 10) : null,
    vehicle: {
      label, year: a.specs.year, make: a.specs.make, model: a.specs.model, trim,
      body: a.specs.body, drive: a.specs.drive, engine: a.specs.engine, fuel: a.specs.fuel,
    },
    vin: a.inputs.vin,
    mileage: a.inputs.mileage,
    zip: a.inputs.zip,
    route: a.route,
    private: a.privateValue,
    instant: a.instantValue,
    retail: a.retailValue,
    base: { label: audit?.mode === 'model' ? 'Model estimate (no local sales data)' : `Weighted median of ${plural(baseCount(s), s.privateComps != null && s.privateComps >= valuationConfig.minPrivateComps ? 'private-seller listing' : 'comparable listing')}`, amount: audit?.base ?? s.weightedMedian },
    adjustments: a.adjustments,
    comps: reportComps,
    compStats: { ...s, summary: audit?.mode === 'model' ? 'Model estimate (no local sales data)' : `${plural(s.used, 'comparable listing')} within ${s.radiusMiles} miles` },
    confidence: a.confidence,
    methodNotes: audit ? [...audit.notes, `Desirability score: ${audit.score.toFixed(2)}.`, ...audit.factors] : methodNotes(s, rows),
    methodVersion: a.methodVersion,
    enrichment: a.enrichment ?? null,
  };
}

export function toPublicReport(r: AppraisalReport): PublicReport {
  const { id: _id, ...rest } = r;
  return rest;
}
