// Maps our color labels to Marketcheck exterior_color values
const COLOR_MAP = {
  White: "white", Black: "black", Silver: "silver", Gray: "gray",
  Red: "red", Blue: "blue", Green: "green", Brown: "brown",
  Orange: "orange", Yellow: "yellow", Gold: "gold",
};

async function fetchPhoto(make, model, year, color) {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY,
    year, make, model,
    rows: "10",
    start: "0",
  });
  if (color) params.set("exterior_color", color);

  const res = await fetch(
    `https://api.marketcheck.com/v2/search/car/active?${params}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const listings = data.listings || [];
  return listings
    .map((l) => l.media?.photo_links?.[0] || l.media?.photo_link || null)
    .find(Boolean) ?? null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const year  = searchParams.get("year");
  const colorLabel = searchParams.get("color") || "";

  if (!make || !model || !year)
    return Response.json({ photo: null }, { status: 400 });
  if (!process.env.MARKETCHECK_API_KEY)
    return Response.json({ photo: null }, { status: 500 });

  try {
    const mcColor = COLOR_MAP[colorLabel] || null;

    // Try color-matched first; fall back to any color if nothing found
    let photo = mcColor ? await fetchPhoto(make, model, year, mcColor) : null;
    if (!photo) photo = await fetchPhoto(make, model, year, null);

    return Response.json({ photo });
  } catch {
    return Response.json({ photo: null });
  }
}
