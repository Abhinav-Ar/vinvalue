// Compact keys keep the URL short enough to share comfortably (~600 chars)

export function encodeProfile({
  decoded, mileage, zip, condition, titleStatus, accidents,
  serviceHistory, owners, warningLights, mechanicalIssues,
  bodyDamage, featuresWorking, keysCount, appraisal,
  recalls = [], safetyRating = null, marketStats = null,
  // Extended sell-profile fields
  exteriorColor = "", interiorColor = "", tireCondition = "",
  glassCondition = "", interiorCleanliness = "", odors = "", roofType = "",
  vehiclePhoto = "",
}) {
  const compact = {
    v:   decoded.VIN,
    mk:  decoded.Make,
    mo:  decoded.Model,
    yr:  decoded.ModelYear,
    tr:  decoded.Trim        || "",
    bd:  decoded.BodyClass   || "",
    eng: decoded.EngineCylinders || "",
    drv: decoded.DriveType   || "",
    fue: decoded.FuelTypePrimary || "",
    mi:  Number(mileage),
    zp:  zip,
    cn:  condition,
    tl:  titleStatus,
    ac:  accidents,
    sv:  serviceHistory,
    ow:  owners,
    wl:  warningLights,
    mch: mechanicalIssues,
    dmg: bodyDamage,
    ft:  featuresWorking,
    ky:  keysCount,
    // Extended sell-profile fields
    ecol: exteriorColor     || "",
    icol: interiorColor     || "",
    trc:  tireCondition     || "",
    glc:  glassCondition    || "",
    intc: interiorCleanliness || "",
    odo:  odors             || "",
    rftp: roofType          || "",
    ph:   vehiclePhoto      || "",
    rt:  appraisal.retail,
    rlo: appraisal.retailRange.low,
    rhi: appraisal.retailRange.high,
    pp:  appraisal.privateParty,
    plo: appraisal.privatePartyRange.low,
    phi: appraisal.privatePartyRange.high,
    ti:  appraisal.tradeIn,
    tlo: appraisal.tradeInRange.low,
    thi: appraisal.tradeInRange.high,
    rc:  recalls.length,
    sf:  safetyRating?.overall ?? null,
    cmp: appraisal.comparables,
    cf:  appraisal.confidence,
    dom: marketStats?.avgDaysOnMarket ?? null,
    at:  new Date().toISOString().split("T")[0],
  };

  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
  } catch {
    return null;
  }
}

export function decodeProfile(encoded) {
  try {
    const payload = String(encoded).split(".")[0];
    const d = JSON.parse(decodeURIComponent(escape(atob(payload))));
    return {
      vin: d.v,
      vehicle: {
        make: d.mk, model: d.mo, year: d.yr, trim: d.tr,
        body: d.bd, engine: d.eng, drive: d.drv, fuel: d.fue,
      },
      condition: {
        mileage: d.mi, zip: d.zp, condition: d.cn, titleStatus: d.tl,
        accidents: d.ac, serviceHistory: d.sv, owners: d.ow,
        warningLights: d.wl, mechanicalIssues: d.mch,
        bodyDamage: d.dmg, featuresWorking: d.ft, keysCount: d.ky,
        exteriorColor: d.ecol || "", interiorColor: d.icol || "",
        tireCondition: d.trc  || "", glassCondition: d.glc  || "",
        interiorCleanliness: d.intc || "", odors: d.odo || "",
        roofType: d.rftp || "",
      },
      vehiclePhoto: d.ph || null,
      appraisal: {
        retail: d.rt,       retailRange: { low: d.rlo, high: d.rhi },
        privateParty: d.pp, privatePartyRange: { low: d.plo, high: d.phi },
        tradeIn: d.ti,      tradeInRange: { low: d.tlo, high: d.thi },
        comparables: d.cmp, confidence: d.cf,
      },
      recallCount: d.rc ?? 0,
      safetyOverall: d.sf ?? null,
      avgDaysOnMarket: d.dom ?? null,
      generatedAt: d.at,
    };
  } catch {
    return null;
  }
}

export async function signProfile(payload) {
  if (!payload) return null;
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", payload }),
  });
  if (!response.ok) return payload;
  return (await response.json()).token || payload;
}

export async function verifyProfile(token) {
  if (!String(token || "").includes(".")) return false;
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", token }),
  });
  return response.ok && Boolean((await response.json()).verified);
}
