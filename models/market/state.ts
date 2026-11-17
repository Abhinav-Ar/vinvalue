import { log } from '@/models/log';
const TTL = 30 * 24 * 60 * 60 * 1000;
const cache = new Map<string, { state: string | null; expires: number }>();
export async function resolveZipState(zip: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const key = zip.trim(); const hit = cache.get(key); if (hit && hit.expires > Date.now()) return hit.state;
  try { const res = await fetchImpl(`https://api.zippopotam.us/us/${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) { cache.set(key, { state: null, expires: Date.now() + 60_000 }); return null; }
    const body = await res.json() as { places?: Array<{ 'state abbreviation'?: string }> };
    const state = body.places?.[0]?.['state abbreviation']?.toUpperCase() ?? null; cache.set(key, { state, expires: Date.now() + TTL }); return state;
  } catch (err) { log.warn('upstream.zip_state.failed', { err }); cache.set(key, { state: null, expires: Date.now() + 60_000 }); return null; }
}
export function clearStateCache() { cache.clear(); }
