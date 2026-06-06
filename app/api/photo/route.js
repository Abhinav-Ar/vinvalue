const COLOR_MAP = {
  White: "white", Black: "black", Silver: "silver", Gray: "gray",
  Red: "red", Blue: "blue", Green: "green", Brown: "brown",
  Orange: "orange", Yellow: "yellow", Gold: "gold",
};

async function fetchPhoto(make, model, year, color) {
  const params = new URLSearchParams({
    api_key: process.env.MARKETCHECK_API_KEY,
    year, make, model,
    rows: "25",
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

  // Prefer the listing with the most photos — dealers with studio/spin shots
  // upload 20–40 photos while iPhone snapshots are typically 1–5.
  const withPhotos = listings
    .map((l) => ({ links: l.media?.photo_links || [], single: l.media?.photo_link }))
    .filter((l) => l.links.length > 0 || l.single)
    .sort((a, b) => b.links.length - a.links.length);

  return withPhotos[0]?.links[0] ?? withPhotos[0]?.single ?? null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const make       = searchParams.get("make");
  const model      = searchParams.get("model");
  const year       = searchParams.get("year");
  const colorLabel = searchParams.get("color") || "";

  if (!make || !model || !year)
    return Response.json({ photo: null }, { status: 400 });
  if (!process.env.MARKETCHECK_API_KEY)
    return Response.json({ photo: null }, { status: 500 });

  try {
    const mcColor = COLOR_MAP[colorLabel] || null;
    let photo = mcColor ? await fetchPhoto(make, model, year, mcColor) : null;
    if (!photo) photo = await fetchPhoto(make, model, year, null);
    return Response.json({ photo });
  } catch {
    return Response.json({ photo: null });
  }
}
