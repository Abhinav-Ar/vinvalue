/**
 * Provider interfaces. Business logic depends only on these; HTTP clients
 * (nhtsa.ts, marketcheck.ts) and fixture-backed fakes (fixtures.ts) implement
 * them. Tests never hit the network.
 */
import type { DecodedSpecs, RecallItem } from '@/lib/db/schema';

export type DecodedVin = DecodedSpecs & {
  vin: string;
  /** Non-fatal decoder notes: check_digit_mismatch, model_year_in_future, ... */
  warnings: string[];
  /** Raw vPIC Results[0] row, kept for the decode cache (vin_decodes.raw). */
  raw?: Record<string, string>;
};

export interface VinDecoder {
  /** Throws UpstreamError on transport failure; AppError 'vin_not_decoded' (422) when NHTSA has no make/model/year. */
  decode(vin: string): Promise<DecodedVin>;
}

export type Listing = {
  id: string;
  /** Used only to de-duplicate the same car listed on several sites. Never persisted. */
  vin: string | null;
  /** MarketCheck inventory_type (e.g. "used", "certified") when present. */
  inventoryType: string | null;
  price: number;
  miles: number;
  /** Miles from the search ZIP. */
  distance: number | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  sellerType: 'dealer' | 'private' | null;
  daysOnMarket: number | null;
};

export type ListingQuery = {
  make: string;
  model: string;
  /** Inclusive year range. */
  yearFrom: number;
  yearTo: number;
  /** Optional exact trim filter (provider-side). */
  trim?: string | null;
  zip: string;
  radiusMiles: number;
  /** Total listings wanted across pages (client paginates in pages of <= 50). */
  maxResults: number;
};

export type ListingResult = { numFound: number; listings: Listing[] };

export interface ListingsProvider {
  /** Active used-car listings. Throws UpstreamError on any non-2xx or malformed body. */
  searchActive(q: ListingQuery): Promise<ListingResult>;
}

export interface RecallsProvider {
  /** NHTSA public API is by make/model/model year, NOT VIN. */
  byModelYear(make: string, model: string, year: number): Promise<RecallItem[]>;
}

export type Providers = {
  vin: VinDecoder;
  listings: ListingsProvider;
  recalls: RecallsProvider;
};
