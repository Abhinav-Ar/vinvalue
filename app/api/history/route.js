import { auth } from "@/auth";
import { Pool } from "pg";
import { jsonError, rateLimit } from "@/lib/requestSafety";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Prune stale entries first — fire-and-forget, don't block the response
  pool.query(
    `DELETE FROM searches WHERE user_id = $1 AND created_at < NOW() - INTERVAL '7 days'`,
    [session.user.id]
  ).catch(() => {});

  const { rows } = await pool.query(
    `SELECT id, vin, make, model, year, trim, mileage, condition, zip,
            trade_in, private_party, retail, profile_encoded, created_at
     FROM searches
     WHERE user_id = $1
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
  await pool.query(
    `DELETE FROM searches WHERE user_id = $1 AND vin = $2`,
    [session.user.id, vin]
  );
  await pool.query(
    `INSERT INTO searches (user_id, vin, make, model, year, trim, mileage, condition, zip,
                           trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [session.user.id, vin, make, model, year, trim, mileage, condition, zip,
     tradeIn, privateParty, retail, profileEncoded]
  );

  return Response.json({ ok: true });
}
