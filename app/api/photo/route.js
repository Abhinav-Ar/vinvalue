const COLOR_MAP = {
  White: "white", Black: "black", Silver: "silver", Gray: "gray",
  Red: "red", Blue: "blue", Green: "green", Brown: "brown",
  Orange: "orange", Yellow: "yellow", Gold: "gold",
};

import { jsonError, rateLimit } from "@/lib/requestSafety";

function safeText(value, max = 60) {
  return String(value || "").trim().slice(0, max);
}

async function fetchPhoto(make, model, year, color, trim) {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY,
    year, make, model,
    rows: "25",
    start: "0",
    car_type: "used",
    min_photo_links: "4",
    photo_links_cached: "true",
  });
  if (color) params.set("exterior_color", color);

  const res = await fetch(
    `https://api.marketcheck.com/v2/search/car/active?${params}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const listings = data.listings || [];

  // Prefer a close trim/color match and cached first-gallery images. Photo count is
  // intentionally not a quality signal: large galleries often lead with ad overlays.
  const withPhotos = listings
    .map((l) => {
      const links = l.media?.photo_links_cached || l.media?.photo_links || [];
      const text = `${l.heading || ""} ${l.build?.trim || ""} ${l.exterior_color || ""}`.toLowerCase();
      let score = 0;
      if (trim && text.includes(trim.toLowerCase())) score += 5;
      if (color && text.includes(color.toLowerCase())) score += 3;
      if (links.length >= 4) score += 2;
      if (/placeholder|no[-_ ]image|coming[-_ ]soon/.test(links[0] || "")) score -= 20;
      return { links, single: l.media?.photo_link, score };
    })
    .filter((l) => l.links.length > 0 || l.single)
    .sort((a, b) => b.score - a.score);

  return withPhotos[0]?.links[0] ?? withPhotos[0]?.single ?? null;
}

export async function GET(request) {
  if (!rateLimit(request, { key: "photo", limit: 40, windowMs: 60_000 })) return jsonError("Too many photo requests.", 429);
  const { searchParams } = new URL(request.url);
  const make       = safeText(searchParams.get("make"));
  const model      = safeText(searchParams.get("model"));
  const year       = safeText(searchParams.get("year"), 4);
  const trim       = safeText(searchParams.get("trim"));
  const colorLabel = safeText(searchParams.get("color"), 24);

  if (!make || !model || !year)
    return Response.json({ photo: null }, { status: 400 });
  if (!process.env.MARKETCHECK_API_KEY)
    return Response.json({ photo: null }, { status: 500 });

  try {
    const mcColor = COLOR_MAP[colorLabel] || null;
    let photo = mcColor ? await fetchPhoto(make, model, year, mcColor, trim) : null;
    if (!photo) photo = await fetchPhoto(make, model, year, null, trim);
    return Response.json({ photo, provenance: photo ? "representative-market-listing" : "none" }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ photo: null });
  }
}
