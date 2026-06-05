import { auth } from "@/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { vin, make, model, year, trim, mileage, condition, zip, tradeIn, privateParty, retail, profileEncoded } = body;

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
