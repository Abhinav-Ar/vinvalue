import { AppError, UpstreamError } from '@/lib/errors';
import { log } from '@/lib/log';
import type { RecallItem } from '@/lib/db/schema';
import type { DecodedVin, RecallsProvider, VinDecoder } from './types';

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues';
const RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

type FetchLike = typeof fetch;

const BODY_WORDS = /\b(coupe|sedan|convertible|hatchback|wagon|cabriolet|roadster|fastback|[2-5]d|[2-5]-door)\b/gi;

/** "L/LE/SE/XLE" -> ["L","LE","SE","XLE"]; "GT Coupe" -> ["GT"]. Exported for tests. */
export function splitTrims(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split('/')) {
    const t = part.replace(BODY_WORDS, '').replace(/\s+/g, ' ').trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out;
}

/** "FORD" -> "Ford", keeps short all-caps brands (BMW, GMC) as-is. */
export function titleCaseMake(make: string): string {
  const m = make.trim();
  if (m.length <= 4 && /^[A-Z]+$/.test(m)) return m;
  return m.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
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
  return {
    vin,
    year,
    make: titleCaseMake(make),
    model,
    trimRaw,
    trimCandidates: splitTrims(trimRaw),
    body: nz(r.BodyClass),
    drive: nz(r.DriveType),
    engine,
    fuel: nz(r.FuelTypePrimary),
    doors: Number(r.Doors) || null,
    plant: [nz(r.PlantCity), nz(r.PlantState), nz(r.PlantCountry)].filter(Boolean).join(', ') || null,
    checkDigitValid: !codes.includes('1'),
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
    return mapVpic(vin, row);
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
