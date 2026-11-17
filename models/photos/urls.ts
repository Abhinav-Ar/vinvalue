const PATH = /^\/v2\/image\/cache\/car\/[A-Za-z0-9_-]+\/[A-Fa-f0-9]+$/;
export function validMarketImagePath(path: unknown): path is string { return typeof path === 'string' && PATH.test(path); }
export function marketPhotoProxyUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    if (u.protocol === 'https:' && u.hostname === 'api.marketcheck.com' && validMarketImagePath(u.pathname)) return `/api/photo/image?path=${encodeURIComponent(u.pathname)}`;
    if (u.protocol === 'https:' && !u.username && !u.password) return u.toString();
  } catch { /* ignore */ }
  return validMarketImagePath(value) ? `/api/photo/image?path=${encodeURIComponent(value)}` : null;
}
