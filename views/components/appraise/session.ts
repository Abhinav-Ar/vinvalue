'use client';
/**
 * The decode result travels from /appraise to /appraise/details in sessionStorage
 * (never in the URL, so the VIN stays out of logs and history).
 */
import type { DecodedSpecs } from '@/models/db/schema';
import type { CarVariant } from '@/views/components/CarDrawing';

/** Response of POST /api/vin/decode (src/app/api/vin/decode/route.ts). */
export type DecodeResult = {
  vin: string;
  year: number;
  make: string;
  model: string;
  trimCandidates: string[];
  trimSource?: 'vpic' | 'reference' | null;
  needsTrimChoice: boolean;
  decodeStatus: 'clean' | 'check_digit_mismatch' | 'partial';
  needsConfirmation: boolean;
  specs: DecodedSpecs;
  warnings: string[];
};

export type StoredDecode = { decode: DecodeResult; importedVehicle: boolean };

const KEY = 'autoiq.appraise.decode';

export function saveDecode(v: StoredDecode) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode: the details page falls back to "enter a VIN first" */
  }
}

export function loadDecode(): StoredDecode | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredDecode;
    return v?.decode?.vin ? v : null;
  } catch {
    return null;
  }
}

/** Plain sentences for the decoder's warning codes (src/lib/vin-decode.ts, src/lib/vin.ts). */
export const WARNING_TEXT: Record<string, string> = {
  check_digit_mismatch_imported:
    'This VIN fails the check digit test. We kept going because you marked the car as imported.',
  check_digit_mismatch: 'This VIN fails the check digit test. Compare it with the plate on the dashboard before you continue.',
  model_year_in_future: 'The decoded model year is later than next year. Check the 10th character of the VIN.',
  model_year_before_17_char_vins: 'The decoded model year is before 1981, when 17-character VINs began. Check the VIN.',
  partial_decode_confirm_details: 'We could only partly decode this VIN. Check the year, make and model before you continue.',
};

/** "Coupe, 4x2, 5.0L V8 gasoline." from decoded specs; skips anything unknown. */
export function specLine(s: { body: string | null; drive: string | null; engine: string | null; fuel: string | null }): string {
  const body = s.body?.split('/')[0]?.trim() || null;
  const power = [s.engine, s.fuel?.toLowerCase()].filter(Boolean).join(' ') || null;
  // vPIC drive values look like "RWD/Rear-Wheel Drive" or "4x2": keep the spelled-out part.
  const drive = s.drive ? (s.drive.split('/')[1] ?? s.drive).trim().toLowerCase() : null;
  const parts = [body, drive, power].filter(Boolean) as string[];
  return parts.length ? `${parts.join(', ')}.` : '';
}

/** Pick the closest line drawing for a car. */
export function carVariant(model: string, body?: string | null): CarVariant {
  const style = body ?? '';
  if (/pickup/i.test(style)) return 'truck';
  if (/utility|multi-purpose|\b(suv|cuv|mpv|minivan|van|wagon)\b/i.test(style)) return 'suv';
  if (/hatchback|liftback|notchback/i.test(style)) return 'hatch';
  if (/sedan|saloon/i.test(style)) return 'sedan';
  if (/convertible|cabriolet/i.test(style)) return 'roadster';
  if (/mx-?5|miata|roadster|boxster|\bz4\b|s2000|spider|spyder|124/i.test(model)) return 'roadster';
  if (/challenger|charger|camaro|chevelle|nova/i.test(model)) return 'muscle';
  if (/coupe/i.test(style)) return 'gt';
  if (/\b(f[- ]?[123]50|silverado|ram|tacoma|tundra|ranger|sierra|frontier|colorado|ridgeline)\b/i.test(model)) return 'truck';
  if (/\b(rav[- ]?4|cr[- ]?v|explorer|wrangler|4runner|tahoe|model [xy]|highlander|outback|forester|pilot|escape|equinox|rogue|cx-?5|sienna|odyssey|pacifica|carnival|minivan)\b/i.test(model)) return 'suv';
  if (/\b(hatchback|golf|gti|fit|prius|leaf)\b/i.test(model)) return 'hatch';
  if (/\b(coupe|corvette|mustang|brz|gr86|911)\b/i.test(model)) return 'gt';
  return 'sedan';
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** What the user typed on the details step, kept per VIN so Back from the report keeps it. */
export type DetailsDraft = {
  vin: string;
  trim: string | null;
  trimConfirmed: boolean;
  trimText: string;
  detailsOk: boolean;
  mileage: string;
  zip: string;
  condition: string;
  title: string;
  accidents: string;
  serviceHistory: string;
  owners: string;
  keys: string;
  warningLights: string;
};

const DRAFT_KEY = 'autoiq.appraise.draft';

export function saveDraft(d: DetailsDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode: the form just starts empty */
  }
}

export function loadDraft(vin: string): DetailsDraft | null {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as DetailsDraft | null;
    return d?.vin === vin ? d : null;
  } catch {
    return null;
  }
}
