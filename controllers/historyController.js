import { auth } from "@/auth";
import { findActivityByUser, replaceLatestAppraisal } from "@/models/history";
import { jsonError, rateLimit } from "@/controllers/http";

function validationError(body) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(body.vin || "").toUpperCase())) return ["Invalid VIN.", 400];
  if (!body.make || !body.model || !Number.isFinite(Number(body.mileage)) || Number(body.mileage) < 0) return ["Invalid vehicle data.", 400];
  if (String(body.profileEncoded || "").length > 20_000) return ["Report data is too large.", 413];
  return null;
}

export async function getHistory() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ searches: await findActivityByUser(session.user.id) });
}

export async function postHistory(request) {
  if (!rateLimit(request, { key: "history-write", limit: 20 })) return jsonError("Too many updates.", 429);
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const error = validationError(body);
  if (error) return jsonError(...error);
  await replaceLatestAppraisal(session.user.id, body);
  return Response.json({ ok: true });
}
