import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setProviders, type Providers } from '@/lib/providers';
import { mapVpic, mapRecall } from '@/lib/providers/nhtsa';
import { mapListing } from '@/lib/providers/marketcheck';
import { UpstreamError } from '@/lib/errors';
import type { ListingQuery } from '@/lib/providers/types';

const FX = join(process.cwd(), 'tests', 'fixtures');
const read = (p: string) => JSON.parse(readFileSync(join(FX, p), 'utf8'));

/** VIN -> recorded vPIC file. Unknown VINs decode as the invalid recording. */
export const FIXTURE_VINS = {
  mustang2019: '1FA6P8CF0K5123456',
  camry2018: '4T1B11HK5JU000000',
  rav42021: '2T3P1RFV5MW000000',
  mx5rf2017: 'JM1NDAM70H0000000',
  partial: 'WZ1DB2C04LW000000',
  invalid: 'ZZZZZZZZZZZZZZZZZ',
} as const;
const VIN_FILES: Record<string, string> = {
  [FIXTURE_VINS.mustang2019]: 'vpic_ford_mustang_2019.json',
  [FIXTURE_VINS.camry2018]: 'vpic_toyota_camry_2018.json',
  [FIXTURE_VINS.rav42021]: 'vpic_toyota_rav4_2021.json',
  [FIXTURE_VINS.mx5rf2017]: 'vpic_mazda_mx5rf_2017.json',
  [FIXTURE_VINS.partial]: 'vpic_partial.json',
};

/** Which synthetic MarketCheck file serves a make/model (lowercased, loose match). */
function listingsFileFor(make: string, model: string): string | null {
  const m = `${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
  const files = readdirSync(join(FX, 'marketcheck')).filter((f) => !f.startsWith('error_'));
  if (m.includes('mx-5')) return 'mx-5';
  return files.find((f) => f.startsWith(m) || (m.includes('supra') && f.includes('supra')) || (m.startsWith('lotus') && f.startsWith('sparse'))) ?? null;
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
        const file = VIN_FILES[vin] ?? 'vpic_invalid.json';
        return mapVpic(vin, read(`nhtsa/${file}`).Results[0]);
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

export function useFixtureProviders(opts: FixtureOptions = {}) {
  const p = fixtureProviders(opts);
  setProviders(p);
  return p;
}
