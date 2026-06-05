import { auth } from "@/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await pool.query(
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
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { vin, make, model, year, trim, nickname, mileage, condition, tradeIn, privateParty, retail, profileEncoded } = body;

  await pool.query(
    `INSERT INTO garage (user_id, vin, make, model, year, trim, nickname, mileage, condition,
                         trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, vin) DO UPDATE
       SET nickname        = EXCLUDED.nickname,
           mileage         = EXCLUDED.mileage,
           condition       = EXCLUDED.condition,
           trade_in        = EXCLUDED.trade_in,
           private_party   = EXCLUDED.private_party,
           retail          = EXCLUDED.retail,
           profile_encoded = EXCLUDED.profile_encoded`,
    [session.user.id, vin, make, model, year, trim, nickname ?? null,
     mileage, condition, tradeIn, privateParty, retail, profileEncoded]
  );

  return Response.json({ ok: true });
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { vin } = await request.json();

  await pool.query(
    "DELETE FROM garage WHERE user_id = $1 AND vin = $2",
    [session.user.id, vin]
  );

  return Response.json({ ok: true });
}
