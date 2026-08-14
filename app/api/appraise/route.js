import { classifyVehicle } from "@/lib/classifyVehicle";
import { cleanVehicleQuery, jsonError, rateLimit } from "@/lib/requestSafety";

const CONDITION_FACTORS = { Excellent: 1.03, Good: 1.0, Fair: 0.94, Poor: 0.84 };
const TITLE_FACTORS    = { Clean: 1.0, Lien: 0.97, Rebuilt: 0.82, Salvage: 0.65 };
const SERVICE_FACTORS  = { "Full dealer": 1.02, "Full independent": 1.01, Partial: 1.0, None: 0.96 };

const RECON_BASE  = { Excellent: 400, Good: 900, Fair: 2200, Poor: 4500 };
const RECON_TITLE = { Clean: 0, Lien: 0, Rebuilt: 1500, Salvage: 3000 };

function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const fraction = index - low;
  return sorted[low + 1] == null ? sorted[low] : sorted[low] + fraction * (sorted[low + 1] - sorted[low]);
}

function buildCompSet(listings, targetMileage) {
  const valid = listings.filter((item) => Number(item.price) >= 2_000 && Number(item.mileage) >= 0);
  if (valid.length < 5) return valid;
  const prices = valid.map((item) => Number(item.price));
  const q1 = percentile(prices, .25);
  const q3 = percentile(prices, .75);
  const iqr = q3 - q1;
  const filtered = valid.filter((item) => item.price >= q1 - 1.5 * iqr && item.price <= q3 + 1.5 * iqr);
  return filtered
    .map((item) => ({ ...item, _distance: Math.abs(Number(item.mileage) - targetMileage) }))
    .sort((a, b) => a._distance - b._distance)
    .slice(0, 20);
}

function weightedPrice(comps, targetMileage) {
  const weighted = comps.map((item) => {
    const mileageGap = Math.abs(Number(item.mileage) - targetMileage);
    const weight = 1 / (1 + mileageGap / 20_000);
    return { price: Number(item.price), weight };
  }).sort((a, b) => a.price - b.price);
  const midpoint = weighted.reduce((sum, item) => sum + item.weight, 0) / 2;
  let cumulative = 0;
  for (const item of weighted) {
    cumulative += item.weight;
    if (cumulative >= midpoint) return item.price;
  }
  return weighted.at(-1)?.price || 0;
}

// ── Data fetchers (each returns a clean result or null/[] on any failure) ──

async function fetchListings(make, model, year, zip, apiKey, trim) {
  const currentYear = new Date().getFullYear();
  const attempts = [
    { basis: "exact-local", year, trim, radius: "100", rows: "25", car_type: "used" },
    { basis: "exact-regional", year, radius: "300", rows: "50", car_type: "used" },
    { basis: "adjacent-model-years", year_range: `${Math.max(1981, Number(year) - 1)}-${year}`, radius: "500", rows: "50", car_type: "used" },
    ...(Number(year) >= currentYear - 1 ? [{ basis: "new-inventory", year, radius: "500", rows: "50", car_type: "new" }] : []),
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { basis, ...filters } = attempt;
    const params = new URLSearchParams({ api_key: apiKey, make, model, zip, sort_by: "price", sort_order: "asc", ...filters });
    if (!filters.trim) params.delete("trim");
    if (filters.year_range) params.delete("year");
    const res = await fetch(`https://api.marketcheck.com/v2/search/car/active?${params}`);
    const text = await res.text();
    if (!res.ok) { lastError = new Error(`MarketCheck ${res.status}: ${text}`); continue; }
    const data = JSON.parse(text);
    const items = (data.listings || []).map((item, i) => ({
      id: item.id || i + 1,
      title: item.heading || `${year} ${make} ${model}`,
      price: item.price || 0,
      mileage: item.miles || 0,
      location: [item.dealer?.city, item.dealer?.state].filter(Boolean).join(", "),
      distance: item.dist ? Math.round(item.dist) : null,
      source: item.dealer?.name || "Listing",
      url: item.vdp_url || "#",
      _photo: item.media?.photo_links_cached?.[0] || item.media?.photo_links?.[0] || item.media?.photo_link || null,
    }));
    if (items.some((item) => Number(item.price) >= 2_000)) {
      items.comparisonBasis = basis;
      return items;
    }
  }
  if (lastError) throw lastError;
  const empty = [];
  empty.comparisonBasis = "prediction-only";
  return empty;
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

async function fetchMarketPrediction(vin, mileage, zip, apiKey) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin || "")) return null;
  const params = new URLSearchParams({ api_key: apiKey, vin, miles: String(mileage), zip, dealer_type: "independent", is_certified: "false" });
  const response = await fetch(`https://api.marketcheck.com/v2/predict/car/us/marketcheck_price?${params}`);
  if (!response.ok) return null;
  const data = await response.json();
  return Number(data.marketcheck_price) || null;
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
    if (!rateLimit(request, { key: "appraise", limit: 12, windowMs: 60_000 })) return jsonError("Too many appraisals. Try again in a minute.", 429);
    const { searchParams } = new URL(request.url);
    const { year, make, model, zip, mileage } = cleanVehicleQuery(searchParams);
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

    if (!process.env.MARKETCHECK_API_KEY)
      return Response.json({ error: "MARKETCHECK_API_KEY is not set" }, { status: 500 });

    const apiKey = process.env.MARKETCHECK_API_KEY;

    // Fire all network calls in parallel — nothing blocks anything
    const [listingsR, statsR, recallsR, safetyR, classificationR, predictionR] = await Promise.allSettled([
      fetchListings(make, model, year, zip, apiKey, searchParams.get("trim") || ""),
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
      fetchMarketPrediction((searchParams.get("vin") || "").toUpperCase(), mileage, zip, apiKey),
    ]);

    // Listings are required — everything else degrades gracefully
    if (listingsR.status === "rejected")
      return Response.json({ error: listingsR.reason?.message || "MarketCheck error" }, { status: 502 });

    const listings       = listingsR.value;
    const marketStats    = statsR.status          === "fulfilled" ? statsR.value          : null;
    const recalls        = recallsR.status        === "fulfilled" ? recallsR.value        : [];
    const safetyRating   = safetyR.status         === "fulfilled" ? safetyR.value         : null;
    const classification = classificationR.status === "fulfilled" ? classificationR.value : null;
    const marketPrediction = predictionR.status === "fulfilled" ? predictionR.value : null;
    const comparisonBasis = listings.comparisonBasis || "exact-local";

    // Return several representative candidates so the browser can recover from a
    // removed or blocked dealer image without showing a broken card.
    const vehiclePhotos = [...new Set(listings.map((l) => l._photo).filter(Boolean))].slice(0, 10);
    const vehiclePhoto = vehiclePhotos[0] ?? null;
    const cleanListings = listings.map((listing) => {
      const clean = { ...listing };
      delete clean._photo;
      return clean;
    });

    const comps = buildCompSet(cleanListings, mileage);
    const prices = comps.map((l) => l.price);
    if (!prices.length && !marketPrediction)
      return Response.json({ error: "We couldn't build a reliable value yet. This model is too new or has too little market data. Try again as inventory appears." }, { status: 404 });

    // ── Adjustment factors ──
    const avgMileage = comps.length ? comps.reduce((s, l) => s + Number(l.mileage), 0) / comps.length : mileage;
    // Most mileage sensitivity is already captured by proximity weighting. This residual
    // adjustment is deliberately capped so high-mileage vehicles cannot be double-penalized.
    const mileageImpact = Math.max(-3_000, Math.min(3_000, Math.round((avgMileage - mileage) * 0.02)));

    // ── Supply / demand factor ──
    // More listings in the area = buyer's market = lower prices.
    // Few listings = scarce or enthusiast car = scarcity premium.
    // Neutral at 20 listings, log-scaled, capped at ±8%.
    const totalListings = marketStats?.totalListings || listings.length;
    const supplyFactor  = comps.length ? Math.max(0.92, Math.min(1.08,
      1 - Math.log(Math.max(totalListings, 1) / 20) * 0.06
    )) : 1;

    const conditionFactor = CONDITION_FACTORS[condition]     ?? 1.0;
    const titleFactor     = TITLE_FACTORS[titleStatus]       ?? 1.0;
    const accidentFactor  = accidents === "Yes" ? 0.9 : 1.0;
    const serviceFactor   = SERVICE_FACTORS[serviceHistory]  ?? 1.0;
    const ownerFactor     = owners <= 2 ? 1.0 : 0.98;
    const totalFactor     = conditionFactor * titleFactor * accidentFactor * serviceFactor * ownerFactor;

    // NHTSA's public model endpoint returns applicable campaigns, not VIN-level open status.
    // Do not apply a price penalty without verified remedy status for this VIN.
    const recallPenalty = 0;

    // ── Reconditioning estimate ──
    const reconBase     = RECON_BASE[condition]   ?? 900;
    const reconMileage  = Math.round(Math.max(0, (mileage - 50000) / 10000) * 300);
    const reconAccident = accidents === "Yes" ? 800 : 0;
    const reconTitle    = RECON_TITLE[titleStatus] ?? 0;
    const reconService  = serviceHistory === "None" ? 300 : serviceHistory === "Partial" ? 150 : 0;
    const reconRecalls  = 0;
    // Extended condition fields
    const reconWarningLights   = warningLights   === "Multiple"     ? 1500 : warningLights   === "Check engine" ? 400  : 0;
    const reconMechanical      = mechanicalIssues === "Major"       ? 2500 : mechanicalIssues === "Minor"       ? 600  : 0;
    const reconBodyDamage      = bodyDamage       === "Major"       ? 2000 : bodyDamage       === "Moderate"    ? 800  : bodyDamage === "Minor" ? 300 : 0;
    const reconFeatures        = featuresWorking  === "Major issues" ? 600 : featuresWorking  === "Minor issues" ? 200 : 0;
    const reconKeys            = keysCount        === "No keys"     ? 350  : keysCount        === "One set"     ? 150  : 0;
    const reconditioning = reconBase + reconMileage + reconAccident + reconTitle + reconService + reconRecalls
      + reconWarningLights + reconMechanical + reconBodyDamage + reconFeatures + reconKeys;

    // ── Three-tier valuation ──
    const compEstimate = comps.length ? weightedPrice(comps, mileage) : null;
    const retailMedian = marketPrediction && compEstimate ? compEstimate * .55 + marketPrediction * .45 : marketPrediction || compEstimate;
    const retail        = Math.max(0, Math.round(retailMedian * totalFactor * supplyFactor + mileageImpact - recallPenalty));
    const tradeIn       = Math.max(0, Math.round(retail - reconditioning - retail * 0.17));
    const ppMultiplier  = classification?.privatePartyMultiplier ?? 0.88;
    const privateParty  = Math.max(0, Math.round(retail * ppMultiplier));

    // Scarce cars have wider ranges — less market data means more price uncertainty.
    // High-supply cars get tighter ranges because the market is well-defined.
    const rawMedian = prices.length ? medianOf(prices) : marketPrediction;
    const medianDeviation = prices.length ? medianOf(prices.map((price) => Math.abs(price - rawMedian))) : rawMedian * .14;
    const observedSpread = rawMedian ? medianDeviation / rawMedian : .14;
    const samplePenalty = comps.length < 8 ? .04 : comps.length < 15 ? .02 : 0;
    const rangeSpread = Math.max(.06, Math.min(.18, observedSpread * 1.5 + samplePenalty));
    const confidence = Math.round(Math.max(45, Math.min(92, 92 - rangeSpread * 180 - samplePenalty * 100)));

    return Response.json({
      listings: cleanListings,
      vehiclePhoto,
      vehiclePhotos,
      recalls,
      recallStatus: "campaigns-for-model",
      safetyRating,
      marketStats,
      marketPrediction,
      comparisonBasis,
      classification,
      appraisal: {
        retail,
        retailRange:       { low: Math.round(retail       * (1 - rangeSpread)),       high: Math.round(retail       * (1 + rangeSpread))       },
        privateParty,
        privatePartyRange: { low: Math.round(privateParty * (1 - rangeSpread)),       high: Math.round(privateParty * (1 + rangeSpread))       },
        tradeIn,
        tradeInRange:      { low: Math.round(tradeIn      * (1 - rangeSpread - 0.01)), high: Math.round(tradeIn     * (1 + rangeSpread + 0.01)) },
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
          mileage:   mileageImpact,
          recalls:   -recallPenalty,
          supply:    Math.round((supplyFactor - 1) * 100),
        },
        comparables: comps.length,
        confidence,
        methodology: marketPrediction
          ? "Blended MarketCheck VIN prediction and mileage-proximity weighted comparables with IQR outlier removal"
          : "Mileage-proximity weighted comparable listings with IQR outlier removal",
        observedSpread: Math.round(observedSpread * 100),
      },
    });
  } catch (err) {
    return Response.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
