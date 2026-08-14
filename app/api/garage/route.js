import { auth } from "@/auth";
import { query } from "@/lib/db";
import { jsonError, rateLimit } from "@/lib/requestSafety";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await query(
    `SELECT id, vin, make, model, year, trim, nickname, mileage, condition,
            trade_in, private_party, retail, profile_encoded, added_at
     FROM garage
     WHERE user_id = $1
     ORDER BY added_at DESC`,
    [session.user.id]
  );

  return Response.json({ cars: rows });
}

export async function POST(request) {
  if (!rateLimit(request, { key: "garage-write", limit: 20 })) return jsonError("Too many updates.", 429);
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { vin, make, model, year, trim, nickname, mileage, condition, tradeIn, privateParty, retail, profileEncoded } = body;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || "").toUpperCase())) return jsonError("Invalid VIN.");
  if (!make || !model || !Number.isFinite(Number(mileage)) || Number(mileage) < 0) return jsonError("Invalid vehicle data.");
  if (String(profileEncoded || "").length > 20_000) return jsonError("Report data is too large.", 413);

  await query(
    `INSERT INTO garage (user_id, vin, make, model, year, trim, nickname, mileage, condition,
                         trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, vin) DO UPDATE
       SET make            = EXCLUDED.make,
           model           = EXCLUDED.model,
           year            = EXCLUDED.year,
           trim            = EXCLUDED.trim,
           nickname        = EXCLUDED.nickname,
           mileage         = EXCLUDED.mileage,
           condition       = EXCLUDED.condition,
           trade_in        = EXCLUDED.trade_in,
           private_party   = EXCLUDED.private_party,
           retail          = EXCLUDED.retail,
           profile_encoded = EXCLUDED.profile_encoded,
           added_at        = NOW()`,
    [session.user.id, vin, make, model, year, trim, nickname ?? null,
     mileage, condition, tradeIn, privateParty, retail, profileEncoded]
  );

  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { vin } = await request.json();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || "").toUpperCase())) return jsonError("Invalid VIN.");

  await query(
    "DELETE FROM garage WHERE user_id = $1 AND vin = $2",
    [session.user.id, vin]
  );

  return Response.json({ ok: true });
}
