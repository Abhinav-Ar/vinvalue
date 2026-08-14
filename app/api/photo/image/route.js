import { validMarketImagePath } from "@/lib/marketPhoto";
import { jsonError, rateLimit } from "@/lib/requestSafety";

export async function GET(request) {
  if (!rateLimit(request, { key: "photo-image", limit: 120 })) return jsonError("Too many image requests.", 429);
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!validMarketImagePath(path)) return jsonError("Invalid image.", 400);
  if (!process.env.MARKETCHECK_API_KEY) return jsonError("Image service is unavailable.", 503);

  try {
    const params = new URLSearchParams({ api_key: process.env.MARKETCHECK_API_KEY });
    const response = await fetch(`https://api.marketcheck.com${path}?${params}`, {
      next: { revalidate: 86400 * 7 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return jsonError("Image is unavailable.", 404);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return jsonError("Invalid image response.", 502);
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      },
    });
  } catch {
    return jsonError("Image is unavailable.", 404);
  }
}
