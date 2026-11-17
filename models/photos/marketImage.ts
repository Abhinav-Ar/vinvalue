import { UpstreamError } from '@/models/errors';
import { validMarketImagePath } from './urls';
export async function fetchMarketImage(path: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!validMarketImagePath(path)) throw new UpstreamError('MarketCheck', 400);
  const key = process.env.MARKETCHECK_API_KEY; if (!key) throw new UpstreamError('MarketCheck', 503);
  const res = await fetchImpl(`https://api.marketcheck.com${path}?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!res.ok) return res;
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(type)) throw new UpstreamError('MarketCheck', 502);
  const length = Number(res.headers.get('content-length') || 0); if (length > 10 * 1024 * 1024) throw new UpstreamError('MarketCheck', 502);
  return res;
}
