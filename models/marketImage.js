export async function fetchMarketImage(path) {
  const params = new URLSearchParams({ api_key: process.env.MARKETCHECK_API_KEY });
  return fetch(`https://api.marketcheck.com${path}?${params}`, {
    next: { revalidate: 86400 * 7 },
    signal: AbortSignal.timeout(5_000),
  });
}
