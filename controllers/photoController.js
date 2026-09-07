import { fetchMarketImage } from "@/models/marketImage";
import { validMarketImagePath } from "@/models/marketPhoto";
import { findVehiclePhotos } from "@/models/vehiclePhoto";
import { jsonError, rateLimit } from "@/controllers/http";

const safeText = (value, max = 60) => String(value || "").trim().slice(0, max);

export async function getVehiclePhotos(request) {
  if (!rateLimit(request, { key: "photo", limit: 40, windowMs: 60_000 })) return jsonError("Too many photo requests.", 429);
  const { searchParams } = new URL(request.url);
  const input = {
    make: safeText(searchParams.get("make")), model: safeText(searchParams.get("model")),
    year: safeText(searchParams.get("year"), 4), trim: safeText(searchParams.get("trim")),
    colorLabel: safeText(searchParams.get("color"), 24),
  };
  if (!input.make || !input.model || !input.year) return Response.json({ photo: null }, { status: 400 });
  if (!process.env.MARKETCHECK_API_KEY) return Response.json({ photo: null }, { status: 500 });
  try {
    return Response.json(await findVehiclePhotos(input), {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return Response.json({ photo: null });
  }
}

export async function getMarketImage(request) {
  if (!rateLimit(request, { key: "photo-image", limit: 120 })) return jsonError("Too many image requests.", 429);
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!validMarketImagePath(path)) return jsonError("Invalid image.", 400);
  if (!process.env.MARKETCHECK_API_KEY) return jsonError("Image service is unavailable.", 503);
  try {
    const response = await fetchMarketImage(path);
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
