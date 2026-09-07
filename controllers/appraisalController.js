import { calculateAppraisal } from "@/models/appraisal";
import { ModelError } from "@/models/errors";
import { jsonError, rateLimit } from "@/controllers/http";

export async function getAppraisal(request) {
  if (!rateLimit(request, { key: "appraise", limit: 12, windowMs: 60_000 })) {
    return jsonError("Too many appraisals. Try again in a minute.", 429);
  }
  try {
    return Response.json(await calculateAppraisal(new URL(request.url).searchParams));
  } catch (error) {
    return jsonError(error.message || "Unexpected server error", error instanceof ModelError ? error.status : 500);
  }
}
