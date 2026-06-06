export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const year  = searchParams.get("year");

  if (!make || !model || !year)
    return Response.json({ photo: null }, { status: 400 });

  if (!process.env.MARKETCHECK_API_KEY)
    return Response.json({ photo: null }, { status: 500 });

  try {
    const params = new URLSearchParams({
      api_key: process.env.MARKETCHECK_API_KEY,
      year, make, model,
      rows: "10",
      start: "0",
    });
    const res = await fetch(
      `https://api.marketcheck.com/v2/search/car/active?${params}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return Response.json({ photo: null });
    const data = await res.json();
    const listings = data.listings || [];
    const photo = listings
      .map((l) => l.media?.photo_links?.[0] || l.media?.photo_link || null)
      .find(Boolean) ?? null;
    return Response.json({ photo });
  } catch {
    return Response.json({ photo: null });
  }
}
