/**
 * Contract for the curated, versioned reference tables that drive the free (no paid data) valuation:
 * original MSRP anchors, collector/enthusiast desirability features, and CPI for inflation adjustment.
 *
 * Data lives in models/reference/data/*.json and is validated by these schemas in tests and at load.
 * Every number that came from the outside world carries a sourceUrl and retrievedAt so it can be audited.
 *
 * Naming: make/model use NHTSA vPIC canonical names (e.g. "FORD" / "Mustang" as vPIC returns them),
 * matched case-insensitively. `generation` is a short stable id unique within make+model, e.g. "S550", "A80", "XV70".
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const year = z.number().int().min(1950).max(2100);
const score01 = z.number().min(0).max(1);
const url = z.string().url();

/** One trim/variant of one generation. MSRP is the US base MSRP (excluding destination, taxes, options) for msrpModelYear. */
export const msrpRowSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  generation: z.string().min(1),
  /** Other model names NHTSA vPIC returns for this model (e.g. "Silverado" for "Silverado 1500", "330i" for "3 Series"). */
  modelAliases: z.array(z.string().min(1)).default([]),
  yearFrom: year,
  yearTo: year,
  /** Canonical trim name, plus aliases as vPIC / sellers spell it ("GT Premium", "GT PREMIUM"). Never a bare substring rule. */
  trim: z.string().min(1),
  trimAliases: z.array(z.string().min(1)).default([]),
  /** Ordinal equipment tier within this generation, 0 = base. Peers may share a tier (XLE and XSE). */
  tier: z.number().int().min(0).max(4),
  body: z.string().nullable().default(null),
  engine: z.string().nullable().default(null),
  transmission: z.enum(['manual', 'automatic', 'dct', 'cvt', 'any']).default('any'),
  drive: z.string().nullable().default(null),
  msrpUsd: z.number().int().min(3000).max(5_000_000),
  /** The model year msrpUsd is quoted for; other years in [yearFrom, yearTo] are CPI-shifted from it. */
  msrpModelYear: year,
  /**
   * documented  = read directly from a source page (sourceUrl required, verified by a script).
   * inferred    = derived from documented rows (sourceUrl required; explain in notes).
   * approximate = best-knowledge figure with NO source; must not carry a sourceUrl. The app labels these
   *               "approximate original price" and widens the valuation range.
   */
  confidence: z.enum(['documented', 'inferred', 'approximate']),
  sourceUrl: url.optional(),
  /** Date the row was authored or verified. */
  retrievedAt: isoDate,
  notes: z.string().optional(),
}).refine((r) => r.yearFrom <= r.yearTo && r.msrpModelYear >= r.yearFrom && r.msrpModelYear <= r.yearTo, {
  message: 'yearFrom <= msrpModelYear <= yearTo required',
}).refine((r) => (r.confidence === 'approximate') === (r.sourceUrl === undefined), {
  message: 'approximate rows must have no sourceUrl; documented/inferred rows must have one',
});
export type MsrpRow = z.infer<typeof msrpRowSchema>;

/**
 * Generation-level desirability features (see the desirability spec):
 * E enthusiast demand, I iconic status, H curated modern-classic/historic status, B enthusiast body config.
 * Ordinary transport cars are simply absent (all zero) - no need to list them.
 */
export const generationRefSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  generation: z.string().min(1),
  yearFrom: year,
  yearTo: year,
  segment: z.enum(['economy', 'midsize', 'fullsize', 'luxury', 'sports', 'supercar', 'suv', 'truck', 'van', 'ev', 'other']),
  E: score01,
  I: score01,
  H: score01,
  B: score01.default(0),
  /** Evidence gate for real appreciation; 1 only with documented sold-price evidence. Defaults to 0 (flatten, never appreciate). */
  G: z.union([z.literal(0), z.literal(1)]).default(0),
  basis: z.string().min(10),
  /** Optional for scores (best-knowledge judgement, explained in basis); REQUIRED when G=1. */
  sourceUrls: z.array(url).default([]),
  retrievedAt: isoDate,
}).refine((g) => g.G === 0 || g.sourceUrls.length > 0, { message: 'G=1 requires sourceUrls with sold-price evidence' });
export type GenerationRef = z.infer<typeof generationRefSchema>;

/** Variant-level features: P performance engineering, L limited supply inputs, T manual preference. */
export const variantRefSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  generation: z.string().min(1),
  /** Must equal an msrpRow.trim for the same make/model/generation. */
  trim: z.string().min(1),
  P: score01,
  /** True only when a confirmed manual is the enthusiast-preferred configuration for this variant. */
  manualPreferred: z.boolean().default(false),
  /** Total US production for the whole generation of this variant, if documented. Null = unknown (not zero). */
  productionCount: z.number().int().positive().nullable().default(null),
  productionScope: z.enum(['us', 'north-america', 'global']).nullable().default(null),
  basis: z.string().min(10),
  /** Optional; productionCount should cite a source when one is known. */
  sourceUrls: z.array(url).default([]),
  retrievedAt: isoDate,
});
export type VariantRef = z.infer<typeof variantRefSchema>;

/** Annual-average CPI-U (BLS series CUUR0000SA0). */
export const cpiRowSchema = z.object({ year, value: z.number().positive() });
export const cpiTableSchema = z.object({
  series: z.literal('CUUR0000SA0'),
  sourceUrl: url,
  retrievedAt: isoDate,
  rows: z.array(cpiRowSchema).min(10),
});
export type CpiTable = z.infer<typeof cpiTableSchema>;

export const msrpTableSchema = z.array(msrpRowSchema);
export const generationTableSchema = z.array(generationRefSchema);
export const variantTableSchema = z.array(variantRefSchema);
