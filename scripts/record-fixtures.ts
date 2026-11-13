/**
 * Records REAL MarketCheck active-listing responses for the fixture vehicles, replacing the
 * synthetic files in tests/fixtures/marketcheck/. Run: npm run fixtures:record
 * Requires MARKETCHECK_API_KEY. Never commits secrets or other people's VINs:
 *  - the api_key is never written (we only store the response body),
 *  - every listing `vin` is replaced with null before writing.
 *    (Tests' VIN de-duplication then falls back to listing ids.)
 * Docs: https://docs.marketcheck.com/docs/api/cars/inventory/inventory-search
 *   GET https://api.marketcheck.com/v2/search/car/active, rows <= 50, start 0-based.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildParams } from '../src/lib/providers/marketcheck';
import type { ListingQuery } from '../src/lib/providers/types';

const BASE = 'https://api.marketcheck.com/v2/search/car/active';
const PAGE = 50;
const MAX = 100;

/** File names match tests/helpers/providers.ts lookup (make_model prefix). */
const TARGETS: { file: string; q: Omit<ListingQuery, 'maxResults' | 'radiusMiles'> }[] = [
  { file: 'ford_mustang_gt_2018-2020_60601.json', q: { make: 'Ford', model: 'Mustang', yearFrom: 2018, yearTo: 2020, zip: '60601', trim: null } },
  { file: 'toyota_camry_2017-2019_60601.json', q: { make: 'Toyota', model: 'Camry', yearFrom: 2017, yearTo: 2019, zip: '60601', trim: null } },
  { file: 'toyota_rav4_2020-2022_94538.json', q: { make: 'Toyota', model: 'RAV4', yearFrom: 2020, yearTo: 2022, zip: '94538', trim: null } },
  { file: 'mazda_mx-5_2016-2018_60614.json', q: { make: 'Mazda', model: 'MX-5 Miata RF', yearFrom: 2016, yearTo: 2018, zip: '60614', trim: null } },
  { file: 'toyota_supra_2019-2021_60601.json', q: { make: 'Toyota', model: 'GR Supra', yearFrom: 2019, yearTo: 2021, zip: '60601', trim: null } },
];

async function main() {
  const key = process.env.MARKETCHECK_API_KEY;
  if (!key) {
    console.error('MARKETCHECK_API_KEY is not set; nothing recorded.');
    process.exit(1);
  }
  const outDir = join(process.cwd(), 'tests', 'fixtures', 'marketcheck');
  mkdirSync(outDir, { recursive: true });
  for (const t of TARGETS) {
    const q: ListingQuery = { ...t.q, radiusMiles: 100, maxResults: MAX };
    const listings: Record<string, unknown>[] = [];
    let numFound = 0;
    for (let start = 0; start < MAX; start += PAGE) {
      const res = await fetch(`${BASE}?${buildParams(q, start, PAGE, key)}`);
      const text = await res.text();
      if (!res.ok) {
        // Body only; the URL (which carries the key) is never printed.
        console.error(`${t.file}: HTTP ${res.status} ${text.slice(0, 300)}`);
        process.exit(1);
      }
      const body = JSON.parse(text) as { num_found?: number; listings?: Record<string, unknown>[] };
      numFound = Number(body.num_found) || 0;
      const page = body.listings ?? [];
      listings.push(...page);
      if (page.length < PAGE || start + PAGE >= numFound) break;
    }
    const scrubbed = listings.map((l) => ({ ...l, vin: null }));
    writeFileSync(join(outDir, t.file), JSON.stringify({ _recorded: new Date().toISOString(), num_found: numFound, listings: scrubbed }, null, 1));
    console.log(`${t.file}: ${scrubbed.length} listings (num_found ${numFound})`);
  }
}

main().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err).replace(/api_key=[^&\s]+/g, 'api_key=[redacted]'));
  process.exit(1);
});
