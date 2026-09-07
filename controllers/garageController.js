import { auth } from "@/auth";
import { findGarageByUser, removeGarageVehicle, saveGarageVehicle } from "@/models/garage";
import { jsonError, rateLimit } from "@/controllers/http";

const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });

function validationError(body) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(body.vin || "").toUpperCase())) return ["Invalid VIN.", 400];
  if (!body.make || !body.model || !Number.isFinite(Number(body.mileage)) || Number(body.mileage) < 0) return ["Invalid vehicle data.", 400];
  if (String(body.profileEncoded || "").length > 20_000) return ["Report data is too large.", 413];
  return null;
}

export async function getGarage() {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return Response.json({ cars: await findGarageByUser(session.user.id) });
}

export async function postGarage(request) {
  if (!rateLimit(request, { key: "garage-write", limit: 20 })) return jsonError("Too many updates.", 429);
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const body = await request.json();
  const error = validationError(body);
  if (error) return jsonError(...error);
  await saveGarageVehicle(session.user.id, body);
  return Response.json({ ok: true });
}

export async function deleteGarage(request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  const { vin } = await request.json();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || "").toUpperCase())) return jsonError("Invalid VIN.");
  await removeGarageVehicle(session.user.id, vin);
  return Response.json({ ok: true });
}
