const buckets = globalThis.__autoiqRateBuckets ?? new Map();
globalThis.__autoiqRateBuckets = buckets;

export function clientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export function rateLimit(request, { limit = 30, windowMs = 60_000, key = "api" } = {}) {
  const now = Date.now();
  const id = `${key}:${clientIp(request)}`;
  const recent = (buckets.get(id) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  buckets.set(id, recent);
  if (buckets.size > 2_000) {
    for (const [bucketKey, times] of buckets) if (!times.some((time) => now - time < windowMs)) buckets.delete(bucketKey);
  }
  return true;
}

export function cleanVehicleQuery(searchParams) {
  const text = (name, max = 60) => (searchParams.get(name) || "").trim().slice(0, max);
  const year = Number(text("year", 4));
  const mileage = Number(text("mileage", 8));
  const zip = text("zip", 10);
  if (!Number.isInteger(year) || year < 1981 || year > new Date().getFullYear() + 1) throw new Error("Enter a valid model year.");
  if (!Number.isFinite(mileage) || mileage < 0 || mileage > 1_500_000) throw new Error("Enter valid mileage.");
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) throw new Error("Enter a valid US ZIP code.");
  const make = text("make");
  const model = text("model");
  if (!make || !model) throw new Error("Year, make, and model are required.");
  return { year: String(year), mileage, zip: zip || "94538", make, model };
}

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
