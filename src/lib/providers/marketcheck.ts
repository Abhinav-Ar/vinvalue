/**
 * MarketCheck active inventory search.
 * Docs: https://docs.marketcheck.com/docs/api/cars/inventory/inventory-search
 *   GET https://api.marketcheck.com/v2/search/car/active
 *   auth: api_key query param
 *   rows max 50 (values above 50 silently fall back to 10), start is 0-based
 *   multi-value params are comma-separated; examples use lowercase make/model
 *   response: { num_found, listings: [{ id, vin, price, miles, dist, dom, dom_active,
 *              seller_type, inventory_type, build: { year, make, model, trim } }], stats? }
 *
 * Likely root causes of the old "too new or too little market data" bug, all fixed here:
 *  - make sent as vPIC's all-caps "TOYOTA"           -> we lowercase make/model
 *  - trim sent as vPIC's "L/LE/SE/XLE"               -> trim is only sent when it is one confirmed value
 *  - rows > 50 silently returned 10 listings         -> we page in rows of 50
 *  - every upstream failure mapped to the same 404   -> UpstreamError (502) with logged status/body
 */
import { UpstreamError } from '@/lib/errors';
import { log, scrubString } from '@/lib/log';
import type { Listing, ListingQuery, ListingResult, ListingsProvider } from './types';

const BASE = 'https://api.marketcheck.com/v2/search/car/active';
const PAGE = 50;

type FetchLike = typeof fetch;

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Map one raw listing; returns null when price/miles/year are unusable. Exported for tests. */
export function mapListing(raw: Record<string, any>): Listing | null {
  const price = num(raw.price);
  const miles = num(raw.miles);
  const year = num(raw.build?.year);
  if (!price || price < 500 || miles == null || miles < 0 || !year) return null;
  const st = typeof raw.seller_type === 'string' ? raw.seller_type.toLowerCase() : null;
  return {
    id: String(raw.id ?? ''),
    price: Math.round(price),
    miles: Math.round(miles),
    distance: num(raw.dist),
    year,
    make: String(raw.build?.make ?? ''),
    model: String(raw.build?.model ?? ''),
    trim: typeof raw.build?.trim === 'string' && raw.build.trim.trim() ? raw.build.trim.trim() : null,
    sellerType: st === 'dealer' ? 'dealer' : st === 'private' || st === 'fsbo' ? 'private' : null,
    daysOnMarket: num(raw.dom_active) ?? num(raw.dom),
  };
}

export function buildParams(q: ListingQuery, start: number, rows: number, apiKey: string): URLSearchParams {
  const years: string[] = [];
  for (let y = q.yearFrom; y <= q.yearTo; y++) years.push(String(y));
  const p = new URLSearchParams({
    api_key: apiKey,
    car_type: 'used',
    make: q.make.toLowerCase(),
    model: q.model.toLowerCase(),
    year: years.join(','),
    zip: q.zip,
    radius: String(q.radiusMiles),
    rows: String(rows),
    start: String(start),
  });
  if (q.trim && !q.trim.includes('/')) p.set('trim', q.trim.toLowerCase());
  return p;
}

export class MarketCheckListings implements ListingsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async searchActive(q: ListingQuery): Promise<ListingResult> {
    const listings: Listing[] = [];
    let numFound = 0;
    for (let start = 0; start < q.maxResults; start += PAGE) {
      const rows = Math.min(PAGE, q.maxResults - start);
      const url = `${BASE}?${buildParams(q, start, rows, this.apiKey)}`;
      let res: Response;
      try {
        res = await this.fetchImpl(url, { signal: AbortSignal.timeout(10000) });
      } catch (err) {
        log.error('upstream.marketcheck.network', { err, url: scrubString(url) });
        throw new UpstreamError('MarketCheck', null);
      }
      const text = await res.text();
      if (!res.ok) {
        // Logged without the key (scrubString) and without VIN/ZIP (query has no VIN; zip param scrubbed below).
        log.error('upstream.marketcheck.status', {
          upstreamStatus: res.status,
          body: text.slice(0, 800),
          make: q.make, model: q.model, years: `${q.yearFrom}-${q.yearTo}`, radius: q.radiusMiles, start, rows,
        });
        throw new UpstreamError('MarketCheck', res.status);
      }
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        log.error('upstream.marketcheck.malformed', { upstreamStatus: res.status, body: text.slice(0, 800) });
        throw new UpstreamError('MarketCheck', res.status, 'MarketCheck returned an unexpected response.');
      }
      if (!Array.isArray(body?.listings)) {
        log.error('upstream.marketcheck.malformed', { upstreamStatus: res.status, keys: Object.keys(body ?? {}) });
        throw new UpstreamError('MarketCheck', res.status, 'MarketCheck returned an unexpected response.');
      }
      numFound = Number(body.num_found) || 0;
      for (const raw of body.listings) {
        const l = mapListing(raw);
        if (l) listings.push(l);
      }
      if (body.listings.length < rows || start + rows >= numFound) break;
    }
    log.info('upstream.marketcheck.ok', { numFound, got: listings.length, make: q.make, model: q.model });
    return { numFound, listings };
  }
}
