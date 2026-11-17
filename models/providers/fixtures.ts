/**
 * Fixture-backed providers (recorded NHTSA + synthetic MarketCheck from tests/fixtures).
 * Used by tests, and by the dev server when PROVIDERS=fixtures (never in production).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Providers } from './types';
import { mapVpic, mapRecall } from './nhtsa';
import { mapListing } from './marketcheck';
import { UpstreamError } from '@/models/errors';
import type { ListingQuery } from './types';

const FX = join(process.cwd(), 'tests', 'fixtures');
const read = (p: string) => JSON.parse(readFileSync(join(FX, p), 'utf8'));

/** VIN -> recorded vPIC file. Unknown VINs decode as the invalid recording. */
/** All pass the check digit except badCheckDigit (the design's sample VIN) and partial/invalid. */
export const FIXTURE_VINS = {
  mustang2019: '1FA6P8CF9K5123456',
  camry2018: '4T1B11HKXJU000000',
  rav42021: '2T3P1RFV3MW000000',
  mx5rf2017: 'JM1NDAM75H0000000',
  supra2020: 'WZ1DB4C07LW000000',
  /** Design's sample VIN: position 9 should be 9. Rejected unless importedVehicle. */
  badCheckDigit: '1FA6P8CF0K5123456',
  /** vPIC partial decode (ErrorCode 1,2,14), check digit also wrong. */
  partial: 'WZ1DB2C04LW000000',
  invalid: 'ZZZZZZZZZZZZZZZZZ',
} as const;
const VIN_FILES: Record<string, string> = {
  [FIXTURE_VINS.mustang2019]: 'vpic_ford_mustang_2019.json',
  [FIXTURE_VINS.camry2018]: 'vpic_toyota_camry_2018.json',
  [FIXTURE_VINS.rav42021]: 'vpic_toyota_rav4_2021.json',
  [FIXTURE_VINS.mx5rf2017]: 'vpic_mazda_mx5rf_2017.json',
  [FIXTURE_VINS.supra2020]: 'vpic_toyota_supra_2020.json',
  [FIXTURE_VINS.badCheckDigit]: 'vpic_bad_check_digit.json',
  [FIXTURE_VINS.partial]: 'vpic_partial.json',
};

/** Which synthetic MarketCheck file serves a make/model (lowercased, loose match). */
function listingsFileFor(make: string, model: string): string | null {
  const m = `${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
  const files = readdirSync(join(FX, 'marketcheck')).filter((f) => !f.startsWith('error_'));
  if (m.includes('mx-5')) return 'mx-5';
  if (m.includes('supra')) return files.find((f) => f.includes('supra')) ?? null;
  return files.find((f) => f.startsWith(m) || (m.startsWith('lotus') && f.startsWith('sparse'))) ?? null;
}

/** Position-10 model year for 2010-2030 (the letters repeat every 30 years; fixtures only need recent cars). */
function modelYearFromVin(vin: string): number | null {
  const i = 'ABCDEFGHJKLMNPRSTVWXY'.indexOf(vin[9] ?? '');
  return i >= 0 ? 2010 + i : null;
}

export type FixtureOptions = {
  /** Force the listings provider to fail like MarketCheck would. */
  listingsFailure?: { status: number } | 'network';
  vinFailure?: { status: number };
};

export function fixtureProviders(opts: FixtureOptions = {}): Providers {
  return {
    vin: {
      async decode(vin) {
        if (opts.vinFailure) throw new UpstreamError('NHTSA vPIC', opts.vinFailure.status);
        const direct = VIN_FILES[vin];
        if (direct) {
          const row = read(`nhtsa/${direct}`).Results[0];
          return { ...mapVpic(vin, row), raw: row };
        }
        // Same make/model/body/engine (VIN positions 1-8) as a recorded VIN: reuse that recording with
        // the model year from position 10, so seeded cars like other Mustang GTs decode in dev.
        const sibling = Object.keys(VIN_FILES).find((k) => k.slice(0, 8) === vin.slice(0, 8));
        const year = modelYearFromVin(vin);
        if (sibling && year) {
          const base = read(`nhtsa/${VIN_FILES[sibling]}`).Results[0];
          if (String(base.ErrorCode) === '0') {
            const row = { ...base, VIN: vin, ModelYear: String(year) };
            return { ...mapVpic(vin, row), raw: row };
          }
        }
        const row = read('nhtsa/vpic_invalid.json').Results[0];
        return { ...mapVpic(vin, row), raw: row };
      },
    },
    listings: {
      async searchActive(q: ListingQuery) {
        if (opts.listingsFailure === 'network') throw new UpstreamError('MarketCheck', null);
        if (opts.listingsFailure) throw new UpstreamError('MarketCheck', opts.listingsFailure.status);
        let file = listingsFileFor(q.make, q.model);
        if (file === 'mx-5') file = readdirSync(join(FX, 'marketcheck')).find((f) => f.startsWith('mazda_mx-5')) ?? null;
        if (!file || !existsSync(join(FX, 'marketcheck', file))) return { numFound: 0, listings: [] };
        const body = read(`marketcheck/${file}`);
        const all = (body.listings as Record<string, unknown>[]).map(mapListing).filter((l): l is NonNullable<typeof l> => !!l);
        const listings = all
          .filter((l) => l.year >= q.yearFrom && l.year <= q.yearTo)
          .filter((l) => (l.distance ?? 0) <= q.radiusMiles)
          .filter((l) => !q.trim || (l.trim ?? '').toLowerCase() === q.trim.toLowerCase())
          .slice(0, q.maxResults);
        return { numFound: listings.length, listings };
      },
    },
    recalls: {
      async byModelYear(make, model, year) {
        const f = `nhtsa/recalls_${make}_${model}_${year}.json`.toLowerCase().replace(/\s+/g, '_');
        if (!existsSync(join(FX, f))) return [];
        return read(f).results.map(mapRecall);
      },
    },
  };
}

