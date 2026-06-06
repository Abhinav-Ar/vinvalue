"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap, Car, Trash2, ExternalLink, Plus, ArrowRight, Pencil, X, Loader2 } from "lucide-react";
import { decodeProfile, encodeProfile } from "@/lib/profileEncoding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import UserMenu from "@/components/UserMenu";
import SellProfilePrompt from "@/components/SellProfilePrompt";

function money(v) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function FieldLabel({ label, children }) {
  return (
    <label className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </label>
  );
}

const EXTERIOR_COLORS = ["White","Black","Silver","Gray","Red","Blue","Green","Brown","Orange","Yellow","Gold","Other"];
const INTERIOR_COLORS = ["Black","Tan / Beige","Gray","Brown","White","Red","Other"];

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <Zap className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-semibold">AutoIQ</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <Link href="/appraise" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Appraise</Link>
          <Link href="/garage" className="rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">Garage</Link>
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}

function CarCard({ car, onRemove, onUpdate, removing }) {
  const profileData = car.profile_encoded ? decodeProfile(car.profile_encoded) : null;
  const stored = profileData?.vehiclePhoto ?? null;
  const cond = profileData?.condition ?? {};

  // Photo
  const [vehiclePhoto, setVehiclePhoto] = useState(stored);
  const exteriorColorStored = cond.exteriorColor || "";

  useEffect(() => {
    if (!exteriorColorStored && stored) { setVehiclePhoto(stored); return; }
    const params = new URLSearchParams({ make: car.make, model: car.model, year: car.year });
    if (exteriorColorStored) params.set("color", exteriorColorStored);
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((d) => { setVehiclePhoto(d.photo || stored); })
      .catch(() => { setVehiclePhoto(stored); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.vin, exteriorColorStored]);

  // Edit modal
  const [editOpen, setEditOpen]   = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");

  // Editable fields — pre-filled from stored profile
  const [mileage,             setMileage]             = useState(String(cond.mileage   ?? car.mileage ?? ""));
  const [zip,                 setZip]                 = useState(cond.zip              ?? "94538");
  const [condition,           setCondition]           = useState(cond.condition        ?? car.condition ?? "Good");
  const [titleStatus,         setTitleStatus]         = useState(cond.titleStatus      ?? "Clean");
  const [accidents,           setAccidents]           = useState(cond.accidents        ?? "No");
  const [serviceHistory,      setServiceHistory]      = useState(cond.serviceHistory   ?? "Partial");
  const [owners,              setOwners]              = useState(String(cond.owners    ?? "1"));
  const [warningLights,       setWarningLights]       = useState(cond.warningLights    ?? "None");
  const [mechanicalIssues,    setMechanicalIssues]    = useState(cond.mechanicalIssues ?? "None");
  const [bodyDamage,          setBodyDamage]          = useState(cond.bodyDamage       ?? "None");
  const [featuresWorking,     setFeaturesWorking]     = useState(cond.featuresWorking  ?? "Yes");
  const [keysCount,           setKeysCount]           = useState(cond.keysCount        ?? "Both sets");
  const [exteriorColor,       setExteriorColor]       = useState(cond.exteriorColor    ?? "");
  const [interiorColor,       setInteriorColor]       = useState(cond.interiorColor    ?? "");
  const [tireCondition,       setTireCondition]       = useState(cond.tireCondition    ?? "All good");
  const [glassCondition,      setGlassCondition]      = useState(cond.glassCondition   ?? "None");
  const [interiorCleanliness, setInteriorCleanliness] = useState(cond.interiorCleanliness ?? "Clean");
  const [odors,               setOdors]               = useState(cond.odors            ?? "None");
  const [roofType,            setRoofType]            = useState(cond.roofType         ?? "Standard");

  async function save() {
    if (!profileData) return;
    setSaving(true);
    setSaveError("");
    try {
      const params = new URLSearchParams({
        year: car.year, make: car.make, model: car.model,
        trim: profileData.vehicle.trim || "", body: profileData.vehicle.body || "",
        engine: profileData.vehicle.engine || "", drive: profileData.vehicle.drive || "",
        fuel: profileData.vehicle.fuel || "",
        zip, mileage, condition, titleStatus, accidents,
        serviceHistory, owners, warningLights, mechanicalIssues,
        bodyDamage, featuresWorking, keysCount,
      });
      const res = await fetch(`/api/appraise?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const decodedVehicle = {
        VIN: profileData.vin,
        Make: car.make, Model: car.model, ModelYear: car.year,
        Trim: profileData.vehicle.trim, BodyClass: profileData.vehicle.body,
        EngineCylinders: profileData.vehicle.engine, DriveType: profileData.vehicle.drive,
        FuelTypePrimary: profileData.vehicle.fuel,
      };

      const encoded = encodeProfile({
        decoded: decodedVehicle, mileage, zip, condition, titleStatus, accidents,
        serviceHistory, owners, warningLights, mechanicalIssues,
        bodyDamage, featuresWorking, keysCount,
        appraisal: data.appraisal, recalls: data.recalls ?? [],
        safetyRating: data.safetyRating, marketStats: data.marketStats,
        exteriorColor, interiorColor, tireCondition, glassCondition,
        interiorCleanliness, odors, roofType,
        vehiclePhoto: data.vehiclePhoto || stored || null,
      });

      await fetch("/api/garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin: car.vin, make: car.make, model: car.model,
          year: car.year, trim: profileData.vehicle.trim,
          mileage, condition,
          tradeIn: data.appraisal.tradeIn,
          privateParty: data.appraisal.privateParty,
          retail: data.appraisal.retail,
          profileEncoded: encoded,
        }),
      });

      onUpdate(car.vin, {
        mileage, condition,
        trade_in: data.appraisal.tradeIn,
        private_party: data.appraisal.privateParty,
        retail: data.appraisal.retail,
        profile_encoded: encoded,
      });

      setEditOpen(false);
    } catch (err) {
      setSaveError(err.message || "Update failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Edit modal ── */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Edit details</p>
                <p className="mt-0.5 text-sm font-semibold">{car.year} {car.make} {car.model}</p>
              </div>
              <button onClick={() => setEditOpen(false)} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-6 space-y-6">
              {/* Basic */}
              <div>
                <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Current state</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Mileage">
                    <Input value={mileage} onChange={(e) => setMileage(e.target.value)} className="h-10 rounded-lg" />
                  </FieldLabel>
                  <FieldLabel label="ZIP code">
                    <Input value={zip} onChange={(e) => setZip(e.target.value)} className="h-10 rounded-lg" />
                  </FieldLabel>
                  <FieldLabel label="Overall condition">
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Excellent","Good","Fair","Poor"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Title status">
                    <Select value={titleStatus} onValueChange={setTitleStatus}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Clean","Lien","Rebuilt","Salvage"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Accidents">
                    <Select value={accidents} onValueChange={setAccidents}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">None</SelectItem>
                        <SelectItem value="Yes">Reported</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Service history">
                    <Select value={serviceHistory} onValueChange={setServiceHistory}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Full dealer">Full dealer</SelectItem>
                        <SelectItem value="Full independent">Full independent</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Prior owners">
                    <Select value={owners} onValueChange={setOwners}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 owner</SelectItem>
                        <SelectItem value="2">2 owners</SelectItem>
                        <SelectItem value="3">3+ owners</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Warning lights">
                    <Select value={warningLights} onValueChange={setWarningLights}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Check engine">Check engine light</SelectItem>
                        <SelectItem value="Multiple">Multiple lights</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Mechanical issues">
                    <Select value={mechanicalIssues} onValueChange={setMechanicalIssues}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None — runs great</SelectItem>
                        <SelectItem value="Minor">Minor</SelectItem>
                        <SelectItem value="Major">Major</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Body damage">
                    <Select value={bodyDamage} onValueChange={setBodyDamage}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Minor">Minor — scratches / dings</SelectItem>
                        <SelectItem value="Moderate">Moderate — dents / paint</SelectItem>
                        <SelectItem value="Major">Major — collision</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Features & electronics">
                    <Select value={featuresWorking} onValueChange={setFeaturesWorking}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">All working</SelectItem>
                        <SelectItem value="Minor issues">Minor issues</SelectItem>
                        <SelectItem value="Major issues">Major issues</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Keys / remotes">
                    <Select value={keysCount} onValueChange={setKeysCount}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Both sets">Both sets</SelectItem>
                        <SelectItem value="One set">One set only</SelectItem>
                        <SelectItem value="No keys">No keys</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                </div>
              </div>

              {/* Appearance */}
              <div>
                <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Appearance & interior</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Exterior color">
                    <Select value={exteriorColor} onValueChange={setExteriorColor}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select color" /></SelectTrigger>
                      <SelectContent>
                        {EXTERIOR_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Interior color">
                    <Select value={interiorColor} onValueChange={setInteriorColor}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select color" /></SelectTrigger>
                      <SelectContent>
                        {INTERIOR_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                        <SelectItem value="Has flat">Has a flat</SelectItem>
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

              {saveError && (
                <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">{saveError}</p>
              )}
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-border">
              <Button variant="outline" className="rounded-lg" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button disabled={saving} className="flex-1 rounded-lg gap-2" onClick={save}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Updating…" : "Save & re-appraise"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Card ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {vehiclePhoto && (
          <div className="overflow-hidden border-b border-border bg-muted relative aspect-video">
            <img src={vehiclePhoto} alt={`${car.year} ${car.make} ${car.model}`} className="absolute left-0 w-full object-cover" style={{ top: "-12%", height: "112%" }} loading="lazy" />
          </div>
        )}

        <div className="flex items-start justify-between gap-2 p-5 pb-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{car.year} {car.make} {car.model}</p>
            {car.trim && <p className="mt-0.5 truncate text-xs text-muted-foreground">{car.trim}</p>}
            {car.nickname && <p className="mt-1 text-xs text-muted-foreground">"{car.nickname}"</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {Number(car.mileage).toLocaleString()} mi · {car.condition}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onRemove(car.vin)}
              disabled={removing === car.vin}
              className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
          {[
            { label: "Trade", value: car.trade_in },
            { label: "Private", value: car.private_party },
            { label: "Retail", value: car.retail },
          ].map(({ label, value }) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-semibold">{money(value)}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Link href={`/appraise?vin=${car.vin}`}>
            <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">Re-appraise</Button>
          </Link>
          {car.profile_encoded ? (
            <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
              <Button variant="outline" size="sm" className="w-full rounded-lg text-xs gap-1">
                Report <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          ) : <div />}
        </div>
      </div>
    </>
  );
}

export default function GaragePage() {
  const { data: session, status } = useSession();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/garage")
      .then((r) => r.json())
      .then((d) => setCars(d.cars ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  async function remove(vin) {
    setRemoving(vin);
    await fetch("/api/garage", { method: "DELETE", body: JSON.stringify({ vin }), headers: { "Content-Type": "application/json" } });
    setCars((prev) => prev.filter((c) => c.vin !== vin));
    setRemoving(null);
  }

  function update(vin, patch) {
    setCars((prev) => prev.map((c) => c.vin === vin ? { ...c, ...patch } : c));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Garage</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">My cars</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Cars you've saved and their latest valuations.</p>
          </div>
          <Link href="/appraise">
            <Button size="sm" className="rounded-lg gap-2">
              <Plus className="h-3.5 w-3.5" /> Add car
            </Button>
          </Link>
        </div>

        {!loading && <SellProfilePrompt cars={cars} />}

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        )}

        {!loading && cars.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
            <Car className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">Your garage is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Run an appraisal and save a car to track it here.</p>
            </div>
            <Link href="/appraise">
              <Button size="sm" className="rounded-lg gap-2">
                Appraise a car <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {!loading && cars.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} onRemove={remove} onUpdate={update} removing={removing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
