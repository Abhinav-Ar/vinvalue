import { jsonError, rateLimit } from "@/lib/requestSafety";

const fields = {
  Make: 26,
  Model: 28,
  ModelYear: 29,
  Trim: 38,
  BodyClass: 5,
  EngineCylinders: 9,
  DriveType: 15,
  FuelTypePrimary: 24,
  TransmissionStyle: 37,
};

export async function GET(request) {
  if (!rateLimit(request, { key: "decode", limit: 30 })) return jsonError("Too many VIN lookups.", 429);
  const vin = new URL(request.url).searchParams.get("vin")?.trim().toUpperCase() || "";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return jsonError("Enter a valid 17-character VIN.");

  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`, {
      next: { revalidate: 86400 * 30 },
    });
    if (!response.ok) return jsonError("VIN service is temporarily unavailable.", 502);
    const payload = await response.json();
    const results = payload.Results || [];
    const vehicle = { VIN: vin };
    for (const [name, id] of Object.entries(fields)) {
      vehicle[name] = results.find((item) => item.VariableId === id)?.Value || "";
    }
    if (!vehicle.Make || !vehicle.Model || !vehicle.ModelYear) return jsonError("We could not identify that VIN.", 404);
    return Response.json({ vehicle }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=2592000" } });
  } catch {
    return jsonError("VIN service is temporarily unavailable.", 502);
  }
}
