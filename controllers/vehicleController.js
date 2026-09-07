import { decodeVin } from "@/models/vehicle";
import { jsonError, rateLimit } from "@/controllers/http";

export async function getDecodedVehicle(request) {
  if (!rateLimit(request, { key: "decode", limit: 30 })) return jsonError("Too many VIN lookups.", 429);
  const vin = new URL(request.url).searchParams.get("vin")?.trim().toUpperCase() || "";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return jsonError("Enter a valid 17-character VIN.");
  try {
    const vehicle = await decodeVin(vin);
    if (!vehicle.Make || !vehicle.Model || !vehicle.ModelYear) return jsonError("We could not identify that VIN.", 404);
    return Response.json({ vehicle }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=2592000" } });
  } catch {
    return jsonError("VIN service is temporarily unavailable.", 502);
  }
}
