import { query } from "@/models/database";

export async function findActivityByUser(userId) {
  const { rows } = await query(
    `WITH latest_searches AS (
       SELECT DISTINCT ON (UPPER(vin)) id, vin, make, model, year, trim, mileage,
              condition, zip, trade_in, private_party, retail, profile_encoded, created_at
       FROM searches WHERE user_id = $1 ORDER BY UPPER(vin), created_at DESC
     ), activity AS (
       SELECT 'appraisal-' || id AS activity_id, id, vin, make, model, year, trim,
              mileage, condition, zip, trade_in, private_party, retail,
              profile_encoded, created_at, 'appraisal' AS source
       FROM latest_searches
       UNION ALL
       SELECT 'garage-' || garage.id, garage.id, garage.vin, garage.make, garage.model,
              garage.year, garage.trim, garage.mileage, garage.condition, NULL::TEXT,
              garage.trade_in, garage.private_party, garage.retail, garage.profile_encoded,
              garage.added_at, 'garage'
       FROM garage WHERE garage.user_id = $1
         AND NOT EXISTS (SELECT 1 FROM latest_searches WHERE UPPER(latest_searches.vin) = UPPER(garage.vin))
     )
     SELECT * FROM activity ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return rows;
}

export async function replaceLatestAppraisal(userId, appraisal) {
  const { vin, make, model, year, trim, mileage, condition, zip, tradeIn, privateParty, retail, profileEncoded } = appraisal;
  await query("DELETE FROM searches WHERE user_id = $1 AND vin = $2", [userId, vin]);
  await query(
    `INSERT INTO searches (user_id, vin, make, model, year, trim, mileage, condition, zip,
                           trade_in, private_party, retail, profile_encoded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [userId, vin, make, model, year, trim, mileage, condition, zip,
     tradeIn, privateParty, retail, profileEncoded]
  );
}
