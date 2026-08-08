import { createHmac, timingSafeEqual } from "node:crypto";
import { jsonError, rateLimit } from "@/lib/requestSafety";

function signature(payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function POST(request) {
  if (!rateLimit(request, { key: "report", limit: 30 })) return jsonError("Too many report requests.", 429);
  const { action = "sign", payload, token } = await request.json();
  if (action === "sign") {
    if (!payload || String(payload).length > 20_000) return jsonError("Invalid report payload.");
    const sig = signature(payload);
    if (!sig) return jsonError("Report signing is not configured.", 503);
    return Response.json({ token: `${payload}.${sig}` });
  }
  if (action === "verify") {
    const [body, supplied, extra] = String(token || "").split(".");
    const expected = body && !extra ? signature(body) : null;
    let verified = false;
    if (expected && supplied && expected.length === supplied.length) {
      verified = timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
    }
    return Response.json({ verified });
  }
  return jsonError("Unknown report action.");
}
