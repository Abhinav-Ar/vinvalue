import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { getDb } from '@/models/db';
import { publicRecordSales } from '@/models/db/schema';
import { normalizeName } from '@/models/publicRecords/ingest';
import { UpstreamError } from '@/models/errors';
import type { Listing, ListingQuery, ListingResult, ListingsProvider } from './types';

export class PublicRecordsListingsProvider implements ListingsProvider {
  constructor(private readonly dbFactory: () => ReturnType<typeof getDb> = getDb) {}
  async searchActive(q: ListingQuery): Promise<ListingResult> {
    let rows: typeof publicRecordSales.$inferSelect[];
    try {
      const db = this.dbFactory();
      const cutoff = new Date(); cutoff.setUTCMonth(cutoff.getUTCMonth() - Number(process.env.PUBLIC_RECORD_RECENCY_MONTHS ?? 24));
      rows = await db.select().from(publicRecordSales).where(and(eq(publicRecordSales.make, normalizeName(q.make)), eq(publicRecordSales.model, normalizeName(q.model)), gte(publicRecordSales.modelYear, q.yearFrom), lte(publicRecordSales.modelYear, q.yearTo), gte(publicRecordSales.transactionDate, cutoff.toISOString().slice(0, 10)), gte(publicRecordSales.odometer, 0))).orderBy(desc(publicRecordSales.transactionDate)).limit(Math.min(q.maxResults, 50));
    } catch {
      throw new UpstreamError('Public records', 503);
    }
    const listings: Listing[] = rows.filter((r) => r.odometer != null).map((r) => ({ id: `wa-public-${r.rowHash.slice(0, 16)}`, vin: null, inventoryType: 'public_record', price: r.salePrice, miles: r.odometer!, distance: null, year: r.modelYear, make: r.make, model: r.model, trim: null, sellerType: 'private', daysOnMarket: null, title: 'Recorded WA title sale (not an asking price)', dealerName: null, dealerCity: null, vdpUrl: null, photos: [] }));
    return { numFound: listings.length, listings, provenance: { stage: 'public-record-sales:recorded-sale', query: q } };
  }
}
