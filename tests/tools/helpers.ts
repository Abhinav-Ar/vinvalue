import type { Db } from '@/models/db';
import * as schema from '@/models/db/schema';
import type { DecodedSpecs, ValueRange } from '@/models/db/schema';
import type { Providers } from '@/models/providers/types';

export const MUSTANG_SPECS: DecodedSpecs = {
  year: 2019, make: 'Ford', model: 'Mustang', trimRaw: 'GT Coupe', trimCandidates: ['GT'],
  body: 'Coupe', drive: null, engine: '5.0L V8', fuel: 'Gasoline', doors: 2, plant: null, checkDigitValid: true,
};

const range = (value: number): ValueRange => ({ value, low: value - 1000, high: value + 1000 });

export async function createVehicle(db: Db, userId: string, over: Partial<typeof schema.vehicles.$inferInsert> = {}) {
  const [v] = await db
    .insert(schema.vehicles)
    .values({
      userId, vin: '1FA6P8CF9K5123456', specs: MUSTANG_SPECS, trim: 'GT', modelKey: 'ford|mustang|gt',
      zip: '60601', odometer: 38200, ...over,
    })
    .returning();
  return v!;
}

export async function createAppraisal(
  db: Db,
  userId: string,
  vehicleId: string,
  a: { privateValue: number; instantValue: number; createdAt: Date; title?: 'clean' | 'rebuilt' | 'salvage'; slug?: string },
) {
  const [row] = await db
    .insert(schema.appraisals)
    .values({
      userId, vehicleId, shareSlug: a.slug ?? crypto.randomUUID().slice(0, 10),
      inputs: {
        vin: '1FA6P8CF9K5123456', trim: 'GT', mileage: 38200, zip: '60601', condition: 'good',
        title: a.title ?? 'clean', accidents: 'none', serviceHistory: null, owners: null, keys: null, warningLights: null,
      },
      specs: MUSTANG_SPECS,
      privateValue: range(a.privateValue),
      instantValue: range(a.instantValue),
      retailValue: range(Math.round(a.privateValue * 1.16)),
      adjustments: [],
      compStats: { found: 20, used: 18, excluded: 2, median: a.privateValue, weightedMedian: a.privateValue, avgMiles: 40000, radiusMiles: 100 },
      methodVersion: 'test',
      createdAt: a.createdAt,
    })
    .returning();
  return row!;
}

/** Wrap a providers object so listing searches are counted. */
export function countingListings(p: Providers) {
  const counter = { calls: 0 };
  const wrapped: Providers = {
    ...p,
    listings: {
      async searchActive(q) {
        counter.calls++;
        return p.listings.searchActive(q);
      },
    },
  };
  return { providers: wrapped, counter };
}

export const ctx = <P extends Record<string, string>>(params?: P) => ({ params: Promise.resolve((params ?? {}) as P) });

export const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(`http://test${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
