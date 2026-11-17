import { AppError } from '@/models/errors';
import { MarketCheckListings, MarketCheckEnrichment } from './marketcheck';
import { NhtsaRecalls, NhtsaVinDecoder } from './nhtsa';
import { NhtsaSafetyRatings } from './nhtsa';
import { fixtureProviders } from './fixtures';
import type { ListingsProvider, Providers } from './types';

export type * from './types';

let override: Partial<Providers> | null = null;

/** Tests swap in fixture-backed providers (tests/helpers/providers.ts). */
export function setProviders(p: Partial<Providers> | null) {
  override = p;
}

class MissingKeyListings implements ListingsProvider {
  async searchActive(): Promise<never> {
    throw new AppError(503, 'not_configured', 'Market data is not configured on this server (MARKETCHECK_API_KEY missing).');
  }
}

export function getProviders(): Providers {
  // Local development without API keys: recorded NHTSA + synthetic MarketCheck fixtures. Never in production.
  if (!override && process.env.PROVIDERS === 'fixtures' && process.env.NODE_ENV !== 'production') return fixtureProviders();
  const key = process.env.MARKETCHECK_API_KEY;
  return {
    vin: override?.vin ?? new NhtsaVinDecoder(),
    listings: override?.listings ?? (key ? new MarketCheckListings(key) : new MissingKeyListings()),
    recalls: override?.recalls ?? new NhtsaRecalls(),
    enrichment: override?.enrichment ?? (key ? { ...new MarketCheckEnrichment(key), safety: (specs) => new NhtsaSafetyRatings().safety(specs) } : { safety: (specs) => new NhtsaSafetyRatings().safety(specs) }),
  };
}
