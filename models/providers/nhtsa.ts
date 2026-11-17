import { AppError, UpstreamError } from '@/models/errors';
import { log } from '@/models/log';
import type { RecallItem } from '@/models/db/schema';
import type { DecodedVin, RecallsProvider, VinDecoder } from './types';
import type { DecodeStatus } from '@/models/db/schema';
import { modelYearWarning } from '@/shared/vin';

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';
const RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

type FetchLike = typeof fetch;

const BODY_WORDS = /\b(coupe|sedan|convertible|hatchback|wagon|cabriolet|roadster|fastback|[2-5]d|[2-5]-door)\b/gi;

/**
 * "L/LE/SE/XLE" -> ["L","LE","SE","XLE"]; "GT Coupe" -> ["GT"]; "Supra 3.0" (model Supra) -> ["3.0"].
 * Exported for tests.
 */
export function splitTrims(raw: string | null | undefined, model?: string | null): string[] {
  if (!raw) return [];
  const modelLc = model?.trim().toLowerCase() || null;
  const out: string[] = [];
  for (const part of raw.split('/')) {
    let t = part.replace(BODY_WORDS, '');
    // Drop words equal to the model name ("Supra 3.0" -> "3.0") without building a regex from data.
    if (modelLc) t = t.split(/\s+/).filter((w) => w.toLowerCase() !== modelLc).join(' ');
    t = t.replace(/\s+/g, ' ').trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** Brands whose official casing is not Title Case. */
const MAKE_CASING: Record<string, string> = {
  BMW: 'BMW', GMC: 'GMC', MINI: 'MINI', RAM: 'Ram', FIAT: 'FIAT', SRT: 'SRT', 'MERCEDES-BENZ': 'Mercedes-Benz',
  'ROLLS-ROYCE': 'Rolls-Royce', MCLAREN: 'McLaren', 'ALFA ROMEO': 'Alfa Romeo', 'LAND ROVER': 'Land Rover',
};

/** "FORD" -> "Ford", "LAND ROVER" -> "Land Rover", "BMW" stays "BMW". */
export function titleCaseMake(make: string): string {
  const m = make.trim();
  const known = MAKE_CASING[m.toUpperCase()];
  if (known) return known;
  return m.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_x, sep: string, c: string) => sep + c.toUpperCase());
}

const nz = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

/** Map a vPIC DecodeVinValues Results[0] row to DecodedVin. Exported for tests. */
export function mapVpic(vin: string, r: Record<string, string>): DecodedVin {
  const codes = String(r.ErrorCode ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  const year = Number(r.ModelYear);
  const make = nz(r.Make);
  const model = nz(r.Model);
  if (!make || !model || !Number.isInteger(year) || year < 1981) {
    throw new AppError(422, 'vin_not_decoded', 'We could not identify a vehicle from this VIN. Check it and try again.', undefined, {
      decoderCodes: codes,
    });
  }
  const trimRaw = [nz(r.Trim), nz(r.Trim2)].filter(Boolean).join('/') || null;
  const disp = Number(r.DisplacementL);
  const cyl = nz(r.EngineCylinders);
  const engine = Number.isFinite(disp) && disp > 0 ? `${disp.toFixed(1)}L${cyl ? ` ${Number(cyl) >= 6 ? 'V' : 'I'}${cyl}` : ''}` : null;
  const warnings: string[] = [];
  if (codes.includes('1')) warnings.push('check_digit_mismatch');
  const yw = modelYearWarning(year);
  if (yw) warnings.push(yw);
  // vPIC: "0" = clean decode. Anything else (other than a lone check-digit code) is partial and
  // must be confirmed by the user rather than treated as fact.
  const nonCheck = codes.filter((c) => c !== '0' && c !== '1');
  const decodeStatus: DecodeStatus = nonCheck.length ? 'partial' : codes.includes('1') ? 'check_digit_mismatch' : 'clean';
  return {
    vin,
    year,
    make: titleCaseMake(make),
    model,
    trimRaw,
    trimCandidates: splitTrims(trimRaw, model),
    body: nz(r.BodyClass),
    drive: nz(r.DriveType),
    engine,
    cylinders: Number(cyl) || null,
    transmission: nz(r.TransmissionStyle),
    fuel: nz(r.FuelTypePrimary),
    doors: Number(r.Doors) || null,
    plant: [nz(r.PlantCity), nz(r.PlantState), nz(r.PlantCountry)].filter(Boolean).join(', ') || null,
    checkDigitValid: !codes.includes('1'),
    decodeStatus,
    decoderCodes: codes,
    warnings,
  };
}

export class NhtsaVinDecoder implements VinDecoder {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async decode(vin: string): Promise<DecodedVin> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${VPIC}/${encodeURIComponent(vin)}?format=json`, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      log.error('upstream.nhtsa_vpic.network', { err });
      throw new UpstreamError('NHTSA vPIC', null);
    }
    const text = await res.text();
    if (!res.ok) {
      log.error('upstream.nhtsa_vpic.status', { upstreamStatus: res.status, body: text.slice(0, 500) });
      throw new UpstreamError('NHTSA vPIC', res.status);
    }
    let row: Record<string, string> | undefined;
    try {
      row = JSON.parse(text)?.Results?.[0];
    } catch {
      /* handled below */
    }
    if (!row) {
      log.error('upstream.nhtsa_vpic.malformed', { body: text.slice(0, 500) });
      throw new UpstreamError('NHTSA vPIC', res.status, 'NHTSA vPIC returned an unexpected response.');
    }
    return { ...mapVpic(vin, row), raw: row };
  }
}

export function mapRecall(r: Record<string, unknown>): RecallItem {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '');
  const d = s('ReportReceivedDate'); // "09/05/2020" (dd/mm/yyyy per NHTSA)
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return {
    campaign: s('NHTSACampaignNumber'),
    component: s('Component'),
    summary: s('Summary'),
    consequence: s('Consequence'),
    remedy: s('Remedy'),
    reportedOn: m ? `${m[3]}-${m[2]}-${m[1]}` : null,
    parkIt: r.parkIt === true,
    parkOutside: r.parkOutSide === true,
  };
}

export class NhtsaRecalls implements RecallsProvider {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async byModelYear(make: string, model: string, year: number) {
    const qs = new URLSearchParams({ make, model, modelYear: String(year) });
    let res: Response;
    try {
      res = await this.fetchImpl(`${RECALLS}?${qs}`, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      log.error('upstream.nhtsa_recalls.network', { err });
      throw new UpstreamError('NHTSA recalls', null);
    }
    const text = await res.text();
    if (!res.ok) {
      log.error('upstream.nhtsa_recalls.status', { upstreamStatus: res.status, body: text.slice(0, 500) });
      throw new UpstreamError('NHTSA recalls', res.status);
    }
    try {
      const results = JSON.parse(text)?.results;
      if (!Array.isArray(results)) throw new Error('no results array');
      return results.map(mapRecall);
    } catch {
      log.error('upstream.nhtsa_recalls.malformed', { body: text.slice(0, 500) });
      throw new UpstreamError('NHTSA recalls', res.status, 'NHTSA recalls returned an unexpected response.');
    }
  }
}

/** Optional two-step NHTSA SafetyRatings lookup. Missing/not-rated values are preserved as null. */
export class NhtsaSafetyRatings {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}
  async safety(specs: { year:number; make:string; model:string }) {
    const base = 'https://api.nhtsa.gov/SafetyRatings';
    try {
      const a = await this.fetchImpl(`${base}/modelyear/${encodeURIComponent(specs.year)}/make/${encodeURIComponent(specs.make)}/model/${encodeURIComponent(specs.model)}?format=json`, { signal: AbortSignal.timeout(4000) });
      if (!a.ok) throw new Error(`status ${a.status}`);
      const body = await a.json() as { Results?: Array<Record<string, unknown>> };
      const first = body.Results?.[0]; const id = first?.VehicleId ?? first?.VehicleID ?? first?.Vehicle_Id;
      if (id == null) return null;
      const b = await this.fetchImpl(`${base}/VehicleId/${encodeURIComponent(String(id))}?format=json`, { signal: AbortSignal.timeout(4000) });
      if (!b.ok) throw new Error(`status ${b.status}`);
      const detail = await b.json() as { Results?: Array<Record<string, unknown>> }; const r = detail.Results?.[0] ?? {};
      const val = (k:string) => typeof r[k] === 'string' && !/^not rated$/i.test(r[k] as string) ? r[k] as string : null;
      return { overall: val('OverallRating'), front: val('OverallFrontCrashRating') ?? val('FrontCrashRating'), side: val('OverallSideCrashRating') ?? val('SideCrashRating'), rollover: val('RolloverRating'), description: val('Description') };
    } catch { return null; }
  }
}
