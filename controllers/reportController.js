import { signReport, verifyReport } from "@/models/report";
import { jsonError, rateLimit } from "@/controllers/http";

export async function postReport(request) {
  if (!rateLimit(request, { key: "report", limit: 30 })) return jsonError("Too many report requests.", 429);
  const { action = "sign", payload, token } = await request.json();
  if (action === "sign") {
    if (!payload || String(payload).length > 20_000) return jsonError("Invalid report payload.");
    const signed = signReport(payload);
    return signed ? Response.json({ token: signed }) : jsonError("Report signing is not configured.", 503);
  }
  if (action === "verify") return Response.json({ verified: verifyReport(token) });
  return jsonError("Unknown report action.");
}
