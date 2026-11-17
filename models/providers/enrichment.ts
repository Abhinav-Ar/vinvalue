import type { DecodedSpecs } from '@/models/db/schema';
import type { MarketEnrichment, MarketEnrichmentProvider, SafetyRating } from './types';

export type EnrichmentSnapshot = { fetchedAt: string; safety?: SafetyRating | null; marketStats?: MarketEnrichment | null; prediction?: MarketEnrichment | null; failures?: string[] };

/** Run optional sources independently, with a small concurrency bound and no impact on valuation. */
export async function loadEnrichments(provider: MarketEnrichmentProvider | undefined, specs: DecodedSpecs, vin: string, now = new Date()): Promise<EnrichmentSnapshot> {
  const fetchedAt = now.toISOString(); const failures: string[] = [];
  if (!provider) return { fetchedAt };
  const safetyProvider = provider;
  const jobs: Array<[string, () => Promise<unknown>]> = [['safety', () => safetyProvider.safety!(specs)], ...(provider?.stats ? [['marketStats', () => provider.stats!(specs)] as [string, () => Promise<unknown>]] : []), ...(provider?.prediction ? [['prediction', () => provider.prediction!(vin)] as [string, () => Promise<unknown>]] : [])];
  const out: Record<string, unknown> = {};
  let next = 0;
  const worker = async () => { while (next < jobs.length) { const i = next++; const [name, job] = jobs[i]!; try { out[name] = await job(); } catch { failures.push(name); } } };
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
  return { fetchedAt, safety: out.safety as SafetyRating | null | undefined, marketStats: out.marketStats as MarketEnrichment | null | undefined, prediction: out.prediction as MarketEnrichment | null | undefined, ...(failures.length ? { failures } : {}) };
}
