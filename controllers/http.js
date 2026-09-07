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

export function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
