/**
 * Price watches and market watches (DB only, no providers).
 *
 * Price watch: target value = vehicles.lastPrivateValue (vehicle watch, alert type "value") or
 * the saved buy check's stored verdict mid (buy-check watch, alert type "price_target"). The
 * buy-check value is the snapshot saved with the check; it changes only when the check is re-saved.
 * A watch alerts when the value moves from not crossed to crossed. lastValue holds the previous
 * observation; it is set at creation, so a watch created already past its threshold stays quiet
 * until the value crosses back and then crosses again. lastValue null counts as not crossed.
 *
 * Market watch: compares the latest stored snapshot median with baselineMedian; alerts when
 * |change| > thresholdPct, then resets the baseline. A null baseline is set without alerting.
 * Snapshots are taken elsewhere (daily job / GET /api/market) so this never calls MarketCheck.
 */
import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { buyChecks, marketSnapshots, marketWatches, priceWatches, vehicles } from '@/models/db/schema';
import type { AlertDraft } from '@/shared/contracts';
import { badRequest, notFound } from '@/models/errors';
import { requireBuyCheck, requireVehicle } from '@/models/ownership';
import { parseModelKey } from '@/shared/model-key';

type Direction = 'below' | 'above';
export const crossed = (value: number, threshold: number, dir: Direction) => (dir === 'below' ? value < threshold : value > threshold);

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function carLabel(specs: { year: number; model: string }, trim: string | null) {
  return [specs.year, specs.model, trim].filter(Boolean).join(' ');
}

/* ------------------------------------------------------------ price watches */
export async function createPriceWatch(
  db: Db,
  userId: string,
  input: { vehicleId?: string | null; buyCheckId?: string | null; threshold: number; direction: Direction },
) {
  if (!!input.vehicleId === !!input.buyCheckId) throw badRequest('Give either vehicleId or buyCheckId.', { vehicleId: ['Give exactly one target.'] });
  let lastValue: number | null = null;
  if (input.vehicleId) lastValue = (await requireVehicle(db, userId, input.vehicleId)).lastPrivateValue;
  else lastValue = (await requireBuyCheck(db, userId, input.buyCheckId!)).verdict.mid;
  const [row] = await db
    .insert(priceWatches)
    .values({ userId, vehicleId: input.vehicleId ?? null, buyCheckId: input.buyCheckId ?? null, threshold: input.threshold, direction: input.direction, lastValue })
    .returning();
  return row!;
}

export async function listPriceWatches(db: Db, userId: string) {
  return db.select().from(priceWatches).where(eq(priceWatches.userId, userId)).orderBy(desc(priceWatches.createdAt));
}

export async function deletePriceWatch(db: Db, userId: string, id: string) {
  const r = await db.delete(priceWatches).where(and(eq(priceWatches.id, id), eq(priceWatches.userId, userId))).returning({ id: priceWatches.id });
  if (!r.length) throw notFound('Price watch');
}

export async function checkPriceWatches(db: Db, today: string): Promise<AlertDraft[]> {
  const watches = await db.select().from(priceWatches);
  if (!watches.length) return [];
  const vIds = watches.map((w) => w.vehicleId).filter((x): x is string => !!x);
  const bIds = watches.map((w) => w.buyCheckId).filter((x): x is string => !!x);
  const vs = vIds.length ? await db.select().from(vehicles).where(inArray(vehicles.id, vIds)) : [];
  const bs = bIds.length ? await db.select().from(buyChecks).where(inArray(buyChecks.id, bIds)) : [];
  const vMap = new Map(vs.map((v) => [v.id, v]));
  const bMap = new Map(bs.map((b) => [b.id, b]));
  const drafts: AlertDraft[] = [];

  for (const w of watches) {
    const v = w.vehicleId ? vMap.get(w.vehicleId) : undefined;
    const b = w.buyCheckId ? bMap.get(w.buyCheckId) : undefined;
    const current = v ? v.lastPrivateValue : b ? b.verdict.mid : null;
    if (current == null) continue;
    const was = w.lastValue != null && crossed(w.lastValue, w.threshold, w.direction);
    const now = crossed(current, w.threshold, w.direction);
    const fire = now && !was;
    if (fire) {
      const label = v ? carLabel(v.specs, v.trim) : carLabel(b!.specs, b!.trim);
      const word = w.direction === 'below' ? 'below' : 'above';
      drafts.push({
        userId: w.userId,
        type: v ? 'value' : 'price_target',
        vehicleId: v?.id ?? null,
        title: v ? `Your ${label} is now ${word} ${usd(w.threshold)}` : `${label} fair value is now ${word} ${usd(w.threshold)}`,
        body: v
          ? `Its private-sale value is about ${usd(current)}. You asked us to tell you when it went ${word} ${usd(w.threshold)}.`
          : `The fair value midpoint for this car is about ${usd(current)}. You asked us to tell you when it went ${word} ${usd(w.threshold)}.`,
        link: v ? `/garage/${v.id}/value` : '/buy',
        dedupeKey: `price:${w.id}:${today}`,
      });
    }
    if (w.lastValue !== current || fire) {
      await db
        .update(priceWatches)
        .set({ lastValue: current, ...(fire ? { lastTriggeredAt: new Date(`${today}T12:00:00Z`) } : {}) })
        .where(eq(priceWatches.id, w.id));
    }
  }
  return drafts;
}

/* ----------------------------------------------------------- market watches */
export async function createMarketWatch(
  db: Db,
  userId: string,
  input: { modelKey: string; zip: string; radiusMiles: number; thresholdPct?: number },
) {
  // Watching the same market twice would send every alert twice: return the existing watch.
  const [existing] = await db
    .select()
    .from(marketWatches)
    .where(and(
      eq(marketWatches.userId, userId),
      eq(marketWatches.modelKey, input.modelKey),
      eq(marketWatches.zip, input.zip),
      eq(marketWatches.radiusMiles, input.radiusMiles),
    ))
    .limit(1);
  if (existing) return existing;
  const latest = await latestSnapshot(db, input, '9999-12-31');
  const [row] = await db
    .insert(marketWatches)
    .values({
      userId, modelKey: input.modelKey, zip: input.zip, radiusMiles: input.radiusMiles,
      ...(input.thresholdPct != null ? { thresholdPct: input.thresholdPct } : {}),
      baselineMedian: latest?.aggregates.medianPrice ?? null,
    })
    .returning();
  return row!;
}

export async function listMarketWatches(db: Db, userId: string) {
  return db.select().from(marketWatches).where(eq(marketWatches.userId, userId)).orderBy(desc(marketWatches.createdAt));
}

export async function deleteMarketWatch(db: Db, userId: string, id: string) {
  const r = await db.delete(marketWatches).where(and(eq(marketWatches.id, id), eq(marketWatches.userId, userId))).returning({ id: marketWatches.id });
  if (!r.length) throw notFound('Market watch');
}

async function latestSnapshot(db: Db, k: { modelKey: string; zip: string; radiusMiles: number }, onOrBefore: string) {
  const [s] = await db
    .select()
    .from(marketSnapshots)
    .where(and(
      eq(marketSnapshots.modelKey, k.modelKey),
      eq(marketSnapshots.zip, k.zip),
      eq(marketSnapshots.radiusMiles, k.radiusMiles),
      lte(marketSnapshots.snapshotDate, onOrBefore),
    ))
    .orderBy(desc(marketSnapshots.snapshotDate))
    .limit(1);
  return s ?? null;
}

export function marketLabel(modelKey: string) {
  const { make, model, trim } = parseModelKey(modelKey);
  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return cap([make, model, trim].filter(Boolean).join(' '));
}

export async function checkMarketWatches(db: Db, today: string): Promise<AlertDraft[]> {
  const watches = await db.select().from(marketWatches);
  const drafts: AlertDraft[] = [];
  for (const w of watches) {
    const snap = await latestSnapshot(db, w, today);
    const med = snap?.aggregates.medianPrice ?? null;
    if (med == null) continue;
    if (w.baselineMedian == null) {
      await db.update(marketWatches).set({ baselineMedian: med }).where(eq(marketWatches.id, w.id));
      continue;
    }
    const pct = ((med - w.baselineMedian) / w.baselineMedian) * 100;
    if (Math.abs(pct) <= w.thresholdPct) continue;
    const label = marketLabel(w.modelKey);
    const dir = pct < 0 ? 'down' : 'up';
    drafts.push({
      userId: w.userId,
      type: 'market',
      vehicleId: null,
      title: `${label} prices are ${dir} ${Math.abs(pct).toFixed(1)}% near you`,
      body: `The median asking price within ${w.radiusMiles} miles moved from ${usd(w.baselineMedian)} to ${usd(med)}.`,
      link: `/market?modelKey=${encodeURIComponent(w.modelKey)}&radius=${w.radiusMiles}`,
      dedupeKey: `market:${w.id}:${snap!.snapshotDate}`,
    });
    await db
      .update(marketWatches)
      .set({ baselineMedian: med, lastNotifiedAt: new Date(`${today}T12:00:00Z`) })
      .where(eq(marketWatches.id, w.id));
  }
  return drafts;
}
