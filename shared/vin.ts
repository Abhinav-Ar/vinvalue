/**
 * VIN check digit (position 9), per 49 CFR 565. Required for North American
 * market vehicles; imported / grey-market vehicles may not follow it, so the
 * API rejects a mismatch unless the caller marks the vehicle as imported,
 * in which case it becomes a warning.
 */
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Expected check character for a 17-char VIN ('0'-'9' or 'X'). */
export function expectedCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i]!;
    const v = /\d/.test(c) ? Number(c) : TRANSLIT[c];
    if (v === undefined) throw new Error('invalid VIN character');
    sum += v * WEIGHTS[i]!;
  }
  const r = sum % 11;
  return r === 10 ? 'X' : String(r);
}

export function checkDigitValid(vin: string): boolean {
  return vin.length === 17 && expectedCheckDigit(vin) === vin[8];
}

/** Replace position 9 with the correct check digit (used for test/demo VINs). */
export function withValidCheckDigit(vin: string): string {
  return vin.slice(0, 8) + expectedCheckDigit(vin) + vin.slice(9);
}

/**
 * Model year code at position 10 repeats every 30 years. vPIC resolves the
 * cycle (using position 7 for passenger cars); we still sanity-check the result.
 * Returns a warning code or null.
 */
export function modelYearWarning(year: number, now = new Date()): string | null {
  const max = now.getUTCFullYear() + 1; // next model year goes on sale in the current calendar year
  if (year > max) return 'model_year_in_future';
  if (year < 1981) return 'model_year_before_17_char_vins';
  return null;
}
