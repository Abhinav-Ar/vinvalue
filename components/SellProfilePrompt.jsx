"use client";

import { useState } from "react";
import { encodeProfile, decodeProfile, signProfile } from "@/lib/profileEncoding";
import { Button } from "@/components/ui/button";
import { X, Loader2, ClipboardList } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function FieldLabel({ label, children }) {
  return (
    <label className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </label>
  );
}

// A profile is considered complete if it has exterior color + tire condition stored
function isComplete(car) {
  if (!car.profile_encoded) return true; // no base data to extend from; handled by re-appraise flow
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(car.profile_encoded))));
    return !!(d.ecol && d.trc);
  } catch { return true; }
}

function carName(car) {
  return [car.year, car.make, car.model].filter(Boolean).join(" ");
}

function conditionPills(car) {
  const p = decodeProfile(car.profile_encoded);
  if (!p) return [];
  return [
    `Body: ${p.condition.bodyDamage}`,
    `Mechanical: ${p.condition.mechanicalIssues}`,
    p.condition.warningLights !== "None" ? `Lights: ${p.condition.warningLights}` : null,
    `Accidents: ${p.condition.accidents}`,
    `Title: ${p.condition.titleStatus}`,
    `Owners: ${p.condition.owners}`,
  ].filter(Boolean);
}

const EXT_COLORS = ["White","Black","Silver","Gray","Red","Blue","Green","Brown","Orange","Yellow","Gold","Other"];
const INT_COLORS = ["Black","Tan / Beige","Gray","Brown","White","Red","Other"];

export default function SellProfilePrompt({ cars }) {
  const [completedVins, setCompletedVins] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [modalCar, setModalCar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
  const [tireCondition, setTireCondition] = useState("All good");
  const [glassCondition, setGlassCondition] = useState("None");
  const [interiorCleanliness, setInteriorCleanliness] = useState("Clean");
  const [odors, setOdors] = useState("None");
  const [roofType, setRoofType] = useState("Standard");

  const incomplete = (cars || []).filter(
    (c) => c.profile_encoded && !isComplete(c) && !completedVins.includes(c.vin)
  );

  if (!incomplete.length || dismissed) return null;

  function openModal(car) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(car.profile_encoded))));
      setExteriorColor(d.ecol || "");
      setInteriorColor(d.icol || "");
      setTireCondition(d.trc  || "All good");
      setGlassCondition(d.glc || "None");
      setInteriorCleanliness(d.intc || "Clean");
      setOdors(d.odo  || "None");
      setRoofType(d.rftp || "Standard");
    } catch {}
    setModalCar(car);
  }

  async function save() {
    if (!modalCar) return;
    setSaving(true);
    const p = decodeProfile(modalCar.profile_encoded);
    if (!p) { setSaving(false); return; }

    const decoded = {
      VIN: p.vin,
      Make: p.vehicle.make,
      Model: p.vehicle.model,
      ModelYear: p.vehicle.year,
      Trim: p.vehicle.trim || "",
      BodyClass: p.vehicle.body || "",
      EngineCylinders: p.vehicle.engine || "",
      DriveType: p.vehicle.drive || "",
      FuelTypePrimary: p.vehicle.fuel || "",
    };

    const encoded = await signProfile(encodeProfile({
      decoded,
      mileage: p.condition.mileage,
      zip: p.condition.zip,
      condition: p.condition.condition,
      titleStatus: p.condition.titleStatus,
      accidents: p.condition.accidents,
      serviceHistory: p.condition.serviceHistory,
      owners: p.condition.owners,
      warningLights: p.condition.warningLights,
      mechanicalIssues: p.condition.mechanicalIssues,
      bodyDamage: p.condition.bodyDamage,
      featuresWorking: p.condition.featuresWorking,
      keysCount: p.condition.keysCount,
      appraisal: {
        retail: p.appraisal.retail,
        retailRange: p.appraisal.retailRange,
        privateParty: p.appraisal.privateParty,
        privatePartyRange: p.appraisal.privatePartyRange,
        tradeIn: p.appraisal.tradeIn,
        tradeInRange: p.appraisal.tradeInRange,
        comparables: p.appraisal.comparables,
        confidence: p.appraisal.confidence,
      },
      recalls: Array(p.recallCount || 0).fill(null),
      safetyRating: p.safetyOverall ? { overall: p.safetyOverall } : null,
      marketStats: p.avgDaysOnMarket ? { avgDaysOnMarket: p.avgDaysOnMarket } : null,
      exteriorColor, interiorColor, tireCondition, glassCondition,
      interiorCleanliness, odors, roofType,
    }));

    await fetch("/api/garage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vin: modalCar.vin,
        make: modalCar.make,
        model: modalCar.model,
        year: modalCar.year,
        trim: modalCar.trim,
        mileage: modalCar.mileage,
        condition: modalCar.condition,
        tradeIn: modalCar.trade_in,
        privateParty: modalCar.private_party,
        retail: modalCar.retail,
        profileEncoded: encoded,
      }),
    }).catch(() => {});

    setCompletedVins((prev) => [...prev, modalCar.vin]);
    setModalCar(null);
    setSaving(false);
  }

  return (
    <>
      {/* Banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-3.5">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="flex-1 min-w-0 text-sm leading-relaxed">
          {incomplete.length === 1 ? (
            <>
              <span className="font-medium">{carName(incomplete[0])}</span>
              <span className="text-muted-foreground"> has an incomplete sell profile — add exterior color, tires &amp; a few more details to unlock faster autofill on Carvana and CarMax.</span>
            </>
          ) : (
            <>
              <span className="font-medium">{incomplete.length} cars</span>
              <span className="text-muted-foreground"> have incomplete sell profiles: </span>
              {incomplete.map((c, i) => (
                <span key={c.vin}>
                  <button onClick={() => openModal(c)} className="underline hover:no-underline text-foreground">{carName(c)}</button>
                  {i < incomplete.length - 1 ? ", " : ""}
                </span>
              ))}
            </>
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0 ml-1">
          {incomplete.length === 1 && (
            <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => openModal(incomplete[0])}>
              Complete →
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Completion modal */}
      {modalCar && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Complete sell profile</p>
                <p className="mt-0.5 text-sm font-semibold">{carName(modalCar)}</p>
              </div>
              <button onClick={() => setModalCar(null)} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              {/* Existing condition pills */}
              <div className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">From your appraisal</p>
                <div className="flex flex-wrap gap-1.5">
                  {conditionPills(modalCar).map((s) => (
                    <span key={s} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>

              {/* Missing extended fields */}
              <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Missing details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Exterior color">
                  <Select value={exteriorColor} onValueChange={setExteriorColor}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select color" /></SelectTrigger>
                    <SelectContent>
                      {EXT_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Interior color">
                  <Select value={interiorColor} onValueChange={setInteriorColor}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select color" /></SelectTrigger>
                    <SelectContent>
                      {INT_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Tire condition">
                  <Select value={tireCondition} onValueChange={setTireCondition}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All good">All four good</SelectItem>
                      <SelectItem value="One needs replacement">One needs replacement</SelectItem>
                      <SelectItem value="Multiple need replacement">Multiple need replacement</SelectItem>
                      <SelectItem value="Has flat">Has a flat tire</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Windshield / glass">
                  <Select value={glassCondition} onValueChange={setGlassCondition}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">No chips or cracks</SelectItem>
                      <SelectItem value="Minor chips">Minor chips</SelectItem>
                      <SelectItem value="Cracked">Cracked windshield</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Interior cleanliness">
                  <Select value={interiorCleanliness} onValueChange={setInteriorCleanliness}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Clean">Clean</SelectItem>
                      <SelectItem value="Light wear">Light wear</SelectItem>
                      <SelectItem value="Stains or damage">Stains or damage</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Odors">
                  <Select value={odors} onValueChange={setOdors}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Slight">Slight / faint</SelectItem>
                      <SelectItem value="Smoke">Smoke</SelectItem>
                      <SelectItem value="Pet">Pet</SelectItem>
                      <SelectItem value="Other">Other odor</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Roof type">
                  <Select value={roofType} onValueChange={setRoofType}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Sunroof">Sunroof</SelectItem>
                      <SelectItem value="Moonroof">Panoramic / moonroof</SelectItem>
                      <SelectItem value="Convertible">Convertible</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
              </div>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-border">
              <Button variant="outline" className="rounded-lg" onClick={() => setModalCar(null)}>
                Cancel
              </Button>
              <Button disabled={saving} className="flex-1 rounded-lg gap-2" onClick={save}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save sell profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
