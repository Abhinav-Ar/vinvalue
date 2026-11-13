import { vi } from 'vitest';
import type { Db } from '@/lib/db';
import { appraisals, documents, serviceEvents, vehicles, odometerReadings, type DecodedSpecs } from '@/lib/db/schema';
import { modelKey } from '@/lib/model-key';

/** Fixed "today" used across garage tests: 2026-11-12 (the design's today). */
export const TODAY = '2026-11-12';

/** Fake only Date so PGlite's timers keep working. Noon UTC = Nov 12 in America/Chicago. */
export function freezeToday() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T18:00:00Z`));
}

export const SPECS: Record<'mustang' | 'mx5' | 'supra', DecodedSpecs> = {
  mustang: { year: 2019, make: 'Ford', model: 'Mustang', trimRaw: 'GT Coupe', trimCandidates: ['GT'], body: 'Coupe', drive: 'RWD', engine: '5.0L V8', fuel: 'Gasoline', doors: 2, plant: 'Flat Rock, MI', checkDigitValid: true, decodeStatus: 'clean' },
  mx5: { year: 2017, make: 'Mazda', model: 'MX-5', trimRaw: 'Grand Touring', trimCandidates: ['Grand Touring'], body: 'Convertible', drive: 'RWD', engine: '2.0L I4', fuel: 'Gasoline', doors: 2, plant: 'Hiroshima', checkDigitValid: true, decodeStatus: 'clean' },
  supra: { year: 2020, make: 'Toyota', model: 'Supra', trimRaw: 'Supra 3.0', trimCandidates: ['3.0'], body: 'Coupe', drive: 'RWD', engine: '3.0L I6', fuel: 'Gasoline', doors: 2, plant: 'Graz', checkDigitValid: true, decodeStatus: 'clean' },
};

let vinSeq = 0;
export async function seedVehicle(db: Db, userId: string, kind: keyof typeof SPECS, over: Partial<typeof vehicles.$inferInsert> = {}) {
  const specs = SPECS[kind];
  const trim = over.trim === undefined ? specs.trimCandidates[0]! : over.trim;
  const createdAt = over.createdAt ?? new Date(Date.UTC(2026, 0, 1 + vinSeq));
  const [v] = await db
    .insert(vehicles)
    .values({
      userId, vin: `TESTVIN${String(++vinSeq).padStart(10, '0')}`, specs, trim, modelKey: modelKey(specs.make, specs.model, trim),
      zip: '60601', odometer: 38_200, ...over, createdAt,
    })
    .returning();
  await db.insert(odometerReadings).values({ vehicleId: v!.id, miles: v!.odometer, recordedOn: '2026-11-01', source: 'manual' });
  return v!;
}

export async function seedAppraisal(db: Db, args: { userId: string; vehicleId?: string | null; vin?: string; value: number; createdAt: Date; reportSeq?: number; specs?: DecodedSpecs; mileage?: number; trim?: string | null; trimConfirmedByUser?: boolean }) {
  const vr = (v: number) => ({ value: v, low: v - 1000, high: v + 1000 });
  const [a] = await db
    .insert(appraisals)
    .values({
      userId: args.userId, vehicleId: args.vehicleId ?? null, shareSlug: crypto.randomUUID(), reportSeq: args.reportSeq ?? 0,
      inputs: {
        vin: args.vin ?? '1FA6P8CF9K5123456', trim: args.trim === undefined ? 'GT' : args.trim, mileage: args.mileage ?? 38_200, zip: '60601',
        condition: 'good', title: 'clean', accidents: 'none', serviceHistory: 'full', owners: 1, keys: 'two', warningLights: 'none',
      },
      specs: args.specs ?? SPECS.mustang,
      privateValue: vr(args.value), instantValue: vr(args.value - 3000), retailValue: vr(args.value + 3000),
      adjustments: [], compStats: { found: 20, used: 18, excluded: 2, median: args.value, weightedMedian: args.value, avgMiles: 40000, radiusMiles: 100 },
      methodVersion: 'test', createdAt: args.createdAt,
      confidence: args.trimConfirmedByUser === undefined ? null : {
        decodeStatus: 'clean', trimConfirmedByUser: args.trimConfirmedByUser, selfReported: ['condition', 'accidents', 'owners'], flags: [], rangeReasons: [], searchTier: 1,
      },
    })
    .returning();
  return a!;
}

export async function seedEvent(db: Db, vehicleId: string, over: Partial<typeof serviceEvents.$inferInsert> & { type: string; title: string; date: string }) {
  const [e] = await db.insert(serviceEvents).values({ vehicleId, status: 'scheduled', ...over }).returning();
  return e!;
}

export async function seedDoc(db: Db, vehicleId: string, over: Partial<typeof documents.$inferInsert> & { kind: (typeof documents.$inferInsert)['kind'] }) {
  const [d] = await db.insert(documents).values({ vehicleId, ...over }).returning();
  return d!;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: { params?: Promise<any> }) => Promise<Response>;

/** Call a route handler directly. */
export async function call(handler: Handler, path: string, opts: { method?: string; body?: unknown; params?: Record<string, string>; form?: FormData } = {}) {
  const init: RequestInit = { method: opts.method ?? 'GET' };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'content-type': 'application/json' };
  }
  const res = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}
