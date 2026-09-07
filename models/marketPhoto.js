const MARKET_IMAGE_PATH = /^\/v2\/image\/cache\/car\/[A-Za-z0-9_-]+\/[A-Fa-f0-9]+$/;

export function marketPhotoProxyUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, "http://autoiq.local");
    if (url.origin === "http://autoiq.local" && url.pathname === "/api/photo/image") {
      const path = url.searchParams.get("path") || "";
      return MARKET_IMAGE_PATH.test(path) ? `/api/photo/image?path=${encodeURIComponent(path)}` : null;
    }
    if (url.hostname !== "api.marketcheck.com" || !MARKET_IMAGE_PATH.test(url.pathname)) return value;
    return `/api/photo/image?path=${encodeURIComponent(url.pathname)}`;
  } catch {
    return null;
  }
}

export function validMarketImagePath(value) {
  return MARKET_IMAGE_PATH.test(value || "");
}
