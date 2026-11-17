/** Shared zod field schemas. Every route composes from these. */
import { z } from 'zod';

/** 17 chars, no I/O/Q. Input is uppercased and stripped of spaces/dashes first. */
export const vinSchema = z
  .string({ error: 'VIN is required.' })
  .transform((s) => s.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .length(17, 'A VIN has exactly 17 characters.')
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VINs use letters and digits only, never I, O or Q.'),
  );

/** US 5-digit ZIP (ZIP+4 accepted, trimmed to 5). Never defaulted. */
export const zipSchema = z
  .string({ error: 'ZIP code is required.' })
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, 'Enter a 5-digit US ZIP code.')
  .transform((s) => s.slice(0, 5));

/** Odometer miles. Accepts "38,200" strings. Upper bound well above any real car. Never defaulted. */
export const mileageSchema = z.preprocess(
  (v) => (typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : v),
  z
    .number({ error: 'Mileage is required and must be a number.' })
    .int('Mileage must be a whole number.')
    .min(0, 'Mileage cannot be negative.')
    .max(999_999, 'Mileage must be under 1,000,000.'),
);

/** Whole-dollar money input, accepts "$27,450". */
export const dollarsSchema = (max = 5_000_000) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : v),
    z.number({ error: 'Enter an amount in dollars.' }).int('Use whole dollars.').min(0).max(max),
  );

export const idSchema = z.string().min(1).max(64);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const radiusSchema = z.coerce.number().pipe(z.union([z.literal(25), z.literal(50), z.literal(100)]));
