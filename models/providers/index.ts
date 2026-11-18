import { MarketCheckListings, MarketCheckEnrichment } from './marketcheck';
import { NhtsaRecalls, NhtsaVinDecoder } from './nhtsa';
import { NhtsaSafetyRatings } from './nhtsa';
import { fixtureProviders } from './fixtures';
import type { ListingsProvider, Providers } from './types';
import { PublicRecordsListingsProvider } from './publicRecords';

export type * from './types';

let override: Partial<Providers> | null = null;

/** Tests swap in fixture-backed providers (tests/helpers/providers.ts). */
export function setProviders(p: Partial<Providers> | null) {
  override = p;
}

export function getProviders(): Providers {
  // Local development without API keys: recorded NHTSA + synthetic MarketCheck fixtures. Never in production.
  if (!override && process.env.PROVIDERS === 'fixtures' && process.env.NODE_ENV !== 'production') return fixtureProviders();
  const key = process.env.MARKETCHECK_API_KEY;
  const useMarketCheck = process.env.MARKET_DATA_PROVIDER === 'marketcheck' && !!key;
  return {
    vin: override?.vin ?? new NhtsaVinDecoder(),
    listings: override?.listings ?? (useMarketCheck ? new MarketCheckListings(key) : new PublicRecordsListingsProvider()),
    recalls: override?.recalls ?? new NhtsaRecalls(),
    enrichment: override?.enrichment ?? (useMarketCheck ? { ...new MarketCheckEnrichment(key), safety: (specs) => new NhtsaSafetyRatings().safety(specs) } : { safety: (specs) => new NhtsaSafetyRatings().safety(specs) }),
  };
}
