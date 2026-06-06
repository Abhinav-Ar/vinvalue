import { classifyVehicle } from "@/lib/classifyVehicle";

const CONDITION_FACTORS = { Excellent: 1.04, Good: 1.0, Fair: 0.93, Poor: 0.84 };
const TITLE_FACTORS    = { Clean: 1.0, Lien: 0.97, Rebuilt: 0.82, Salvage: 0.65 };
const SERVICE_FACTORS  = { "Full dealer": 1.04, "Full independent": 1.02, Partial: 1.0, None: 0.95 };

const RECON_BASE  = { Excellent: 400, Good: 900, Fair: 2200, Poor: 4500 };
const RECON_TITLE = { Clean: 0, Lien: 0, Rebuilt: 1500, Salvage: 3000 };

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Data fetchers (each returns a clean result or null/[] on any failure) ──

async function fetchListings(make, model, year, zip, apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey,
    year, make, model,
    zip, radius: "100", rows: "25",
    sort_by: "price", sort_order: "asc",
  });
  const res = await fetch(`https://api.marketcheck.com/v2/search/car/active?${params}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`MarketCheck ${res.status}: ${text}`);
  const data = JSON.parse(text);
  return (data.listings || []).map((item, i) => ({
    id: item.id || i + 1,
    title: item.heading || `${year} ${make} ${model}`,
    price: item.price || 0,
    mileage: item.miles || 0,
    location: [item.dealer?.city, item.dealer?.state].filter(Boolean).join(", "),
    distance: item.dist ? Math.round(item.dist) : null,
    source: item.dealer?.name || "Listing",
    url: item.vdp_url || "#",
    // First photo from this listing (used to pick a representative vehicle image)
    _photo: item.media?.photo_links?.[0] || item.media?.photo_link || null,
  }));
}

async function fetchMarketStats(make, model, year, zip, apiKey) {
  const params = new URLSearchParams({ api_key: apiKey, make, model, year, zip, radius: "100" });
  const res = await fetch(`https://api.marketcheck.com/v2/stats/car/active?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.price) return null;
  return {
    avgPrice: Math.round(data.price.mean ?? 0),
    medianPrice: Math.round(data.price.median ?? 0),
    avgMiles: Math.round(data.miles?.mean ?? 0),
    avgDaysOnMarket: Math.round(data.dom?.mean ?? 0),
    totalListings: data.listings_count ?? 0,
  };
}

async function fetchRecalls(make, model, year) {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r) => ({
    campaign: r.NHTSACampaignNumber,
    component: r.Component,
    summary: r.Summary,
    consequence: r.Consequence,
    remedy: r.Remedy,
  }));
}

async function fetchSafetyRating(year, make, model) {
  // Step 1: resolve vehicle IDs for this year/make/model
  const listUrl = `https://api.nhtsa.gov/SafetyRatings/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`;
  const listRes = await fetch(listUrl, { next: { revalidate: 86400 } });
  if (!listRes.ok) return null;
  const listData = await listRes.json();
  const vehicleId = listData.Results?.[0]?.VehicleId;
  if (!vehicleId) return null;

  // Step 2: get ratings for the first variant
  const ratingRes = await fetch(`https://api.nhtsa.gov/SafetyRatings/VehicleId/${vehicleId}`, {
    next: { revalidate: 86400 },
  });
  if (!ratingRes.ok) return null;
  const ratingData = await ratingRes.json();
  const r = ratingData.Results?.[0];
  if (!r) return null;

  return {
    overall: r.OverallRating,
    frontCrash: r.OverallFrontCrashRating,
    sideCrash: r.OverallSideCrashRating,
    rollover: r.RolloverRating,
    description: r.VehicleDescription,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const year  = searchParams.get("year");
    const make  = searchParams.get("make");
    const model = searchParams.get("model");
    const zip   = searchParams.get("zip")      || "94538";
    const mileage       = Number(searchParams.get("mileage"))  || 65000;
    const condition     = searchParams.get("condition")     || "Good";
    const titleStatus   = searchParams.get("titleStatus")   || "Clean";
    const accidents      = searchParams.get("accidents")      || "No";
    const serviceHistory = searchParams.get("serviceHistory") || "Partial";
    const owners         = Number(searchParams.get("owners")) || 1;
    const warningLights  = searchParams.get("warningLights")  || "None";
    const mechanicalIssues = searchParams.get("mechanicalIssues") || "None";
    const bodyDamage     = searchParams.get("bodyDamage")     || "None";
    const featuresWorking = searchParams.get("featuresWorking") || "Yes";
    const keysCount      = searchParams.get("keysCount")      || "Both sets";

    if (!year || !make || !model)
      return Response.json({ error: "year, make, and model are required" }, { status: 400 });
    if (!process.env.MARKETCHECK_API_KEY)
      return Response.json({ error: "MARKETCHECK_API_KEY is not set" }, { status: 500 });

    const apiKey = process.env.MARKETCHECK_API_KEY;

    // Fire all network calls in parallel — nothing blocks anything
    const [listingsR, statsR, recallsR, safetyR, classificationR] = await Promise.allSettled([
      fetchListings(make, model, year, zip, apiKey),
      fetchMarketStats(make, model, year, zip, apiKey),
      fetchRecalls(make, model, year),
      fetchSafetyRating(year, make, model),
      classifyVehicle({
        year, make, model,
        trim:   searchParams.get("trim")   || "",
        body:   searchParams.get("body")   || "",
        engine: searchParams.get("engine") || "",
        drive:  searchParams.get("drive")  || "",
        fuel:   searchParams.get("fuel")   || "",
      }),
    ]);

    // Listings are required — everything else degrades gracefully
    if (listingsR.status === "rejected")
      return Response.json({ error: listingsR.reason?.message || "MarketCheck error" }, { status: 502 });

    const listings       = listingsR.value;
    const marketStats    = statsR.status          === "fulfilled" ? statsR.value          : null;
    const recalls        = recallsR.status        === "fulfilled" ? recallsR.value        : [];
    const safetyRating   = safetyR.status         === "fulfilled" ? safetyR.value         : null;
    const classification = classificationR.status === "fulfilled" ? classificationR.value : null;

    // Pick the first usable photo from any listing, then strip _photo from the public response
    const vehiclePhoto = listings.find((l) => l._photo)?._photo ?? null;
    const cleanListings = listings.map(({ _photo, ...rest }) => rest);

    const prices = cleanListings.map((l) => l.price).filter((p) => p > 1000);
    if (!prices.length)
      return Response.json({ error: "No listings found for this vehicle in your area." }, { status: 404 });

    // ── Adjustment factors ──
    const avgMileage    = listings.reduce((s, l) => s + l.mileage, 0) / listings.length;
    const mileageDelta  = (avgMileage - mileage) * 0.045;

    const conditionFactor = CONDITION_FACTORS[condition]     ?? 1.0;
    const titleFactor     = TITLE_FACTORS[titleStatus]       ?? 1.0;
    const accidentFactor  = accidents === "Yes" ? 0.9 : 1.0;
    const serviceFactor   = SERVICE_FACTORS[serviceHistory]  ?? 1.0;
    const ownerFactor     = owners === 1 ? 1.02 : owners === 2 ? 1.0 : 0.97;
    const totalFactor     = conditionFactor * titleFactor * accidentFactor * serviceFactor * ownerFactor;

    // Open recalls reduce value — each unresolved recall costs buyers time and trust
    const recallPenalty = Math.min(recalls.length * 300, 1000);

    // ── Reconditioning estimate ──
    const reconBase     = RECON_BASE[condition]   ?? 900;
    const reconMileage  = Math.round(Math.max(0, (mileage - 50000) / 10000) * 150);
    const reconAccident = accidents === "Yes" ? 800 : 0;
    const reconTitle    = RECON_TITLE[titleStatus] ?? 0;
    const reconService  = serviceHistory === "None" ? 300 : serviceHistory === "Partial" ? 150 : 0;
    const reconRecalls  = recalls.length > 0 ? Math.min(recalls.length * 200, 600) : 0;
    // Extended condition fields
    const reconWarningLights   = warningLights   === "Multiple"     ? 1500 : warningLights   === "Check engine" ? 400  : 0;
    const reconMechanical      = mechanicalIssues === "Major"       ? 2500 : mechanicalIssues === "Minor"       ? 600  : 0;
    const reconBodyDamage      = bodyDamage       === "Major"       ? 2000 : bodyDamage       === "Moderate"    ? 800  : bodyDamage === "Minor" ? 300 : 0;
    const reconFeatures        = featuresWorking  === "Major issues" ? 600 : featuresWorking  === "Minor issues" ? 200 : 0;
    const reconKeys            = keysCount        === "No keys"     ? 350  : keysCount        === "One set"     ? 150  : 0;
    const reconditioning = reconBase + reconMileage + reconAccident + reconTitle + reconService + reconRecalls
      + reconWarningLights + reconMechanical + reconBodyDamage + reconFeatures + reconKeys;

    // ── Three-tier valuation ──
    const retailMedian  = medianOf(prices);
    const retail        = Math.max(0, Math.round(retailMedian * totalFactor + mileageDelta - recallPenalty));
    const tradeIn       = Math.max(0, Math.round(retail - reconditioning - retail * 0.17));
    const ppMultiplier  = classification?.privatePartyMultiplier ?? 0.88;
    const privateParty  = Math.max(0, Math.round(retail * ppMultiplier));

    return Response.json({
      listings: cleanListings,
      vehiclePhoto,
      recalls,
      safetyRating,
      marketStats,
      classification,
      appraisal: {
        retail,
        retailRange:       { low: Math.round(retail       * 0.94), high: Math.round(retail       * 1.06) },
        privateParty,
        privatePartyRange: { low: Math.round(privateParty * 0.94), high: Math.round(privateParty * 1.06) },
        tradeIn,
        tradeInRange:      { low: Math.round(tradeIn      * 0.93), high: Math.round(tradeIn      * 1.07) },
        reconditioning,
        reconditioningBreakdown: {
          base: reconBase, mileage: reconMileage, accident: reconAccident,
          title: reconTitle, service: reconService, recalls: reconRecalls,
          warningLights: reconWarningLights, mechanical: reconMechanical,
          bodyDamage: reconBodyDamage, features: reconFeatures, keys: reconKeys,
        },
        adjustments: {
          condition: Math.round((conditionFactor - 1) * 100),
          title:     Math.round((titleFactor     - 1) * 100),
          accident:  Math.round((accidentFactor  - 1) * 100),
          service:   Math.round((serviceFactor   - 1) * 100),
          owner:     Math.round((ownerFactor     - 1) * 100),
          mileage:   Math.round(mileageDelta),
          recalls:   -recallPenalty,
        },
        comparables: prices.length,
        confidence:  Math.min(96, Math.max(52, 55 + prices.length * 2)),
      },
    });
  } catch (err) {
    return Response.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
