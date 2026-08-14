import { auth } from "@/auth";
import { query } from "@/lib/db";
import { jsonError, rateLimit } from "@/lib/requestSafety";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await query(
    `WITH latest_searches AS (
       SELECT DISTINCT ON (UPPER(vin))
              id, vin, make, model, year, trim, mileage, condition, zip,
              trade_in, private_party, retail, profile_encoded, created_at
       FROM searches
       WHERE user_id = $1
       ORDER BY UPPER(vin), created_at DESC
     ), activity AS (
       SELECT 'appraisal-' || id AS activity_id, id, vin, make, model, year, trim,
              mileage, condition, zip, trade_in, private_party, retail,
              profile_encoded, created_at, 'appraisal' AS source
       FROM latest_searches
       UNION ALL
       SELECT 'garage-' || garage.id AS activity_id, garage.id, garage.vin,
              garage.make, garage.model, garage.year, garage.trim, garage.mileage,
              garage.condition, NULL::TEXT AS zip, garage.trade_in,
              garage.private_party, garage.retail, garage.profile_encoded,
              garage.added_at AS created_at, 'garage' AS source
       FROM garage
       WHERE garage.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM latest_searches WHERE UPPER(latest_searches.vin) = UPPER(garage.vin)
         )
     )
     SELECT * FROM activity
     ORDER BY created_at DESC
     LIMIT 50`,
    [session.user.id]
  );

  return Response.json({ searches: rows });
}

export async function POST(request) {
  if (!rateLimit(request, { key: "history-write", limit: 20 })) return jsonError("Too many updates.", 429);
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { vin, make, model, year, trim, mileage, condition, zip, tradeIn, privateParty, retail, profileEncoded } = body;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin || "").toUpperCase())) return jsonError("Invalid VIN.");
  if (!make || !model || !Number.isFinite(Number(mileage)) || Number(mileage) < 0) return jsonError("Invalid vehicle data.");
  if (String(profileEncoded || "").length > 20_000) return jsonError("Report data is too large.", 413);

  // Delete any previous entry for this VIN so we only keep the latest appraisal per car
  await query(
    `DELETE FROM searches WHERE user_id = $1 AND vin = $2`,
    [session.user.id, vin]
  );
  await query(
    `INSERT INTO searches (user_id, vin, make, model, year, trim, mileage, condition, zip,
                           trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [session.user.id, vin, make, model, year, trim, mileage, condition, zip,
     tradeIn, privateParty, retail, profileEncoded]
  );

  return Response.json({ ok: true });
}
