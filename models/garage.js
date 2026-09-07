import { query } from "@/models/database";

export async function findGarageByUser(userId) {
  const { rows } = await query(
    `SELECT id, vin, make, model, year, trim, nickname, mileage, condition,
            trade_in, private_party, retail, profile_encoded, added_at
     FROM garage WHERE user_id = $1 ORDER BY added_at DESC`,
    [userId]
  );
  return rows;
}

export async function saveGarageVehicle(userId, vehicle) {
  const { vin, make, model, year, trim, nickname, mileage, condition, tradeIn, privateParty, retail, profileEncoded } = vehicle;
  await query(
    `INSERT INTO garage (user_id, vin, make, model, year, trim, nickname, mileage, condition,
                         trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, vin) DO UPDATE
       SET make = EXCLUDED.make, model = EXCLUDED.model, year = EXCLUDED.year,
           trim = EXCLUDED.trim, nickname = EXCLUDED.nickname, mileage = EXCLUDED.mileage,
           condition = EXCLUDED.condition, trade_in = EXCLUDED.trade_in,
           private_party = EXCLUDED.private_party, retail = EXCLUDED.retail,
           profile_encoded = EXCLUDED.profile_encoded, added_at = NOW()`,
    [userId, vin, make, model, year, trim, nickname ?? null,
     mileage, condition, tradeIn, privateParty, retail, profileEncoded]
  );
}

export async function removeGarageVehicle(userId, vin) {
  await query("DELETE FROM garage WHERE user_id = $1 AND vin = $2", [userId, vin]);
}
