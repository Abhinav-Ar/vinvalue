export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const zip = searchParams.get("zip");
    const mileage = searchParams.get("mileage");

    if (!year || !make || !model) {
      return Response.json({ error: "year, make, and model are required" }, { status: 400 });
    }

    if (!process.env.MARKETCHECK_API_KEY) {
      return Response.json({ error: "MARKETCHECK_API_KEY is not set" }, { status: 500 });
    }

    const mileageNum = Number(mileage) || 65000;
    const milesMin = Math.max(0, mileageNum - 30000);
    const milesMax = mileageNum + 30000;

    const params = new URLSearchParams({
      api_key: process.env.MARKETCHECK_API_KEY,
      year,
      make,
      model,
      zip: zip || "94538",
      radius: "100",
      miles_min: String(milesMin),
      miles_max: String(milesMax),
      rows: "12",
      start: "0",
      sort_by: "price",
      sort_order: "asc",
    });

    const mcRes = await fetch(
      `https://marketcheck-prod.apigee.net/v2/search/car/active?${params}`,
      { headers: { "Content-Type": "application/json" } }
    );

    const text = await mcRes.text();

    if (!mcRes.ok) {
      return Response.json({ error: `MarketCheck error ${mcRes.status}`, detail: text }, { status: mcRes.status });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json({ error: "MarketCheck returned invalid JSON", detail: text }, { status: 502 });
    }

    const listings = (data.listings || []).map((item, index) => ({
      id: item.id || index + 1,
      title: item.heading || `${year} ${make} ${model}`,
      price: item.price || 0,
      mileage: item.miles || 0,
      location: [item.dealer?.city, item.dealer?.state].filter(Boolean).join(", "),
      distance: item.dist ? Math.round(item.dist) : null,
      source: item.dealer?.name || "Listing",
      url: item.vdp_url || "#",
      matchScore: 90,
    }));

    return Response.json({ listings });
  } catch (err) {
    return Response.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
