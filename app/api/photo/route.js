const COLOR_MAP = {
  White: "white", Black: "black", Silver: "silver", Gray: "gray",
  Red: "red", Blue: "blue", Green: "green", Brown: "brown",
  Orange: "orange", Yellow: "yellow", Gold: "gold",
};

import { jsonError, rateLimit } from "@/lib/requestSafety";
import { marketPhotoProxyUrl } from "@/lib/marketPhoto";

function safeText(value, max = 60) {
  return String(value || "").trim().slice(0, max);
}

async function fetchPhoto(make, model, year, color, trim) {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY,
    year, make, model,
    rows: "40",
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
  if (!res.ok) return [];
  const data = await res.json();
  const listings = data.listings || [];

  // Prefer a close trim/color match and cached first-gallery images. Photo count is
  // intentionally not a quality signal: large galleries often lead with ad overlays.
  const withPhotos = listings
    .map((l) => {
      const links = l.media?.photo_links_cached || l.media?.photo_links || [];
      const text = `${l.heading || ""} ${l.build?.trim || ""} ${l.exterior_color || ""}`.toLowerCase();
      let score = 0;
      const normalizedTrim = trim?.toLowerCase();
      if (normalizedTrim && text.includes(normalizedTrim)) score += 12;
      if (color && text.includes(color.toLowerCase())) score += 7;
      if (links.length >= 8) score += 4;
      else if (links.length >= 4) score += 2;
      if (l.build?.year && String(l.build.year) === String(year)) score += 8;
      if (l.build?.model && String(l.build.model).toLowerCase() === model.toLowerCase()) score += 8;
      if (l.media?.photo_links_cached?.length) score += 3;
      const first = links[0] || l.media?.photo_link || "";
      if (/placeholder|no[-_ ]image|coming[-_ ]soon|spacer|logo/.test(first)) score -= 100;
      return { links: links.length ? links : [l.media?.photo_link].filter(Boolean), score };
    })
    .filter((l) => l.links.length > 0 && l.score > -50)
    .sort((a, b) => b.score - a.score);

  // Dealers frequently put promotions or detail shots first. Prefer the second
  // gallery frame from several strong listings, then third frames, and retain the
  // lead frame only as a last fallback. This also prevents one bad gallery from
  // dominating every candidate.
  const preferred = [1, 2, 0].flatMap((index) =>
    withPhotos.slice(0, 8).map((listing) => listing.links[index]).filter(Boolean)
  );
  return [...new Set(preferred.map(marketPhotoProxyUrl).filter(Boolean))].slice(0, 16);
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
    let photos = mcColor ? await fetchPhoto(make, model, year, mcColor, trim) : [];
    if (photos.length < 4) {
      const unfiltered = await fetchPhoto(make, model, year, null, trim);
      photos = [...new Set([...photos, ...unfiltered])].slice(0, 10);
    }
    return Response.json({
      photo: photos[0] || null,
      photos,
      provenance: photos.length ? "representative-market-listing" : "none",
    }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
  } catch {
    return Response.json({ photo: null });
  }
}
