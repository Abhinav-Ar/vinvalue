/**
 * The one way feature code decodes a VIN:
 *  1. Format already validated by vinSchema (17 chars, no I/O/Q).
 *  2. Check digit (position 9): a mismatch is a 400 on fields.vin ("check character 9"), unless the
 *     caller says the vehicle is imported / grey-market, in which case it becomes a warning.
 *  3. Cache: build specs never change, so a VIN is decoded by vPIC once and stored in vin_decodes
 *     with the raw response and timestamp.
 *  4. vPIC's own ErrorCode drives decodeStatus; 'partial' means "needs user confirmation".
 * Logs carry decoder codes and status, never the VIN.
 */
import { eq } from 'drizzle-orm';
import type { Db } from './db';
import { vinDecodes, type DecodedSpecs } from './db/schema';
import { badRequest } from './errors';
import { log } from './log';
import type { DecodedVin, Providers } from './providers/types';
import { checkDigitValid, expectedCheckDigit, modelYearWarning } from './vin';

export type DecodeOptions = {
  /** Imported / grey-market vehicles may not follow the check digit rule: warn instead of blocking. */
  importedVehicle?: boolean;
  now?: Date;
};

export function assertCheckDigit(vin: string, importedVehicle = false): string[] {
  if (checkDigitValid(vin)) return [];
  if (importedVehicle) return ['check_digit_mismatch_imported'];
  throw badRequest('This VIN does not pass the check digit test. It is probably mistyped.', {
    vin: [`Check character 9 should be ${expectedCheckDigit(vin)}, not ${vin[8]}. Re-check the VIN. If the car was imported, mark it as imported.`],
  });
}

export async function decodeVin(db: Db, providers: Providers, vin: string, opts: DecodeOptions = {}): Promise<DecodedVin> {
  const checkWarnings = assertCheckDigit(vin, opts.importedVehicle);

  const [cached] = await db.select().from(vinDecodes).where(eq(vinDecodes.vin, vin)).limit(1);
  let decoded: DecodedVin;
  if (cached) {
    decoded = { ...cached.decoded, vin, warnings: [] };
  } else {
    decoded = await providers.vin.decode(vin);
    const { raw, warnings: _w, vin: _v, ...specs } = decoded;
    await db
      .insert(vinDecodes)
      .values({ vin, raw: raw ?? {}, decoded: specs as DecodedSpecs })
      .onConflictDoNothing();
    log.info('vin.decoded', { decodeStatus: decoded.decodeStatus, decoderCodes: decoded.decoderCodes });
  }

  // Recompute warnings every time (year sanity depends on "now").
  const warnings = new Set<string>(checkWarnings);
  if (!decoded.checkDigitValid && !checkWarnings.length) warnings.add('check_digit_mismatch');
  const yw = modelYearWarning(decoded.year, opts.now);
  if (yw) warnings.add(yw);
  if (decoded.decodeStatus === 'partial') warnings.add('partial_decode_confirm_details');
  const { raw: _raw, ...rest } = decoded;
  return { ...rest, warnings: [...warnings] };
}

/** Mileage sanity: far above typical use for the car's age. Returns flags for the confidence block. */
export function mileageFlags(mileage: number, modelYear: number, highMilesPerYear: number, now = new Date()): string[] {
  const ageYears = Math.max(0.5, now.getUTCFullYear() - modelYear + 0.5);
  return mileage / ageYears > highMilesPerYear ? ['mileage_high_for_age'] : [];
}
