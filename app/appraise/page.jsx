"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Search, Gauge, MapPin, ShieldCheck, AlertTriangle, Loader2,
  ExternalLink, Zap, RotateCcw, Car, Users, Wrench, X,
  DollarSign, ChevronDown, ChevronUp, Star, TriangleAlert,
  Clock, BarChart2, CheckCircle, FileText, Copy, ClipboardCheck, Lock,
} from "lucide-react";
import { encodeProfile } from "@/lib/profileEncoding";
import { useSession, signIn } from "next-auth/react";
import UserMenu from "@/components/UserMenu";
import DepreciationChart from "@/components/DepreciationChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function money(v) {
  if (!Number.isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function miles(v) {
  if (!Number.isFinite(v)) return "0 mi";
  return new Intl.NumberFormat("en-US").format(Math.round(v)) + " mi";
}

function getVehicleValue(results, variableId) {
  const found = results?.find((r) => r.VariableId === variableId);
  return found?.Value || "";
}

function groupRecalls(recalls) {
  const seen = new Set();
  const unique = recalls.filter((r) => {
    if (seen.has(r.campaign)) return false;
    seen.add(r.campaign);
    return true;
  });
  const groups = {};
  for (const r of unique) {
    const cat = (r.component?.split(":")?.[0] || "Other").trim().replace(/\b\w/g, (c) => c.toUpperCase());
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  }
  return groups;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

function FieldLabel({ label, children }) {
  return (
    <label className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </label>
  );
}

const INSTANT_BUYERS = [
  {
    id: "carvana",
    name: "Carvana",
    tagline: "Online · Free pickup · 7-day lock",
    multiplier: 1.02,
    spread: 0.07,
    getUrl: () => "https://www.carvana.com/sell-my-car",
    speed: "2 min",
  },
  {
    id: "carmax",
    name: "CarMax",
    tagline: "In-person · Same-day payment",
    multiplier: 0.97,
    spread: 0.05,
    getUrl: (vin) => `https://www.carmax.com/sell-my-car?vin=${vin}`,
    speed: "Same day",
  },
  {
    id: "cargurus",
    name: "CarGurus",
    tagline: "Online · Dealer network",
    multiplier: 0.99,
    spread: 0.08,
    getUrl: () => "https://www.cargurus.com/sell/",
    speed: "Same day",
  },
  {
    id: "kbb",
    name: "KBB Cash Offer",
    tagline: "Local dealer network",
    multiplier: 0.95,
    spread: 0.10,
    getUrl: () => "https://www.kbb.com/instant-cash-offer/",
    speed: "Same day",
  },
  {
    id: "autonation",
    name: "AutoNation",
    tagline: "Large dealer group · Nationwide",
    multiplier: 0.93,
    spread: 0.08,
    getUrl: () => "https://www.autonation.com/sell-my-car",
    speed: "Same day",
  },
  {
    id: "peddle",
    name: "Peddle",
    tagline: "Any condition · Free tow",
    multiplier: 0.78,
    spread: 0.12,
    getUrl: () => "https://www.peddle.com/",
    speed: "Same day",
  },
];

const PRIVATE_CHANNELS = [
  {
    id: "facebook",
    name: "Facebook Marketplace",
    tagline: "Highest price · Largest local pool",
    getUrl: () => "https://www.facebook.com/marketplace/create/vehicle",
    con: "Days to weeks · Must meet strangers",
  },
  {
    id: "craigslist",
    name: "Craigslist",
    tagline: "Free listing · Cash buyers",
    getUrl: () => "https://www.craigslist.org/about/sites",
    con: "More scam risk · No buyer verification",
  },
  {
    id: "autotrader",
    name: "AutoTrader",
    tagline: "Paid listing · Serious buyers",
    getUrl: () => "https://www.autotrader.com/sell-my-car",
    con: "$49–$99 listing fee · Slower",
  },
];

const TIPS = [
  ["Get 3+ instant offers first", "Carvana, CarMax, and Vroom quotes are binding for 7 days. Use them as leverage with dealers or private buyers."],
  ["Clean the car before any appraisal", "A detailed car gets $300–$800 more on average. Do it before the CarMax visit and before listing photos."],
  ["Have your title ready", "A lien slows everything down. Call your bank first if you're still paying it off."],
  ["Don't mention a trade-in early", "If buying another car, negotiate the purchase price before disclosing you have a trade-in."],
];

export default function AppraisePage() {
  const [vin, setVin] = useState("");
  const [decoded, setDecoded] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mileage, setMileage] = useState("65000");
  const [zip, setZip] = useState("94538");
  const [condition, setCondition] = useState("Good");
  const [titleStatus, setTitleStatus] = useState("Clean");
  const [accidents, setAccidents] = useState("No");
  const [serviceHistory, setServiceHistory] = useState("Partial");
  const [owners, setOwners] = useState("1");
  const [warningLights, setWarningLights] = useState("None");
  const [mechanicalIssues, setMechanicalIssues] = useState("None");
  const [bodyDamage, setBodyDamage] = useState("None");
  const [featuresWorking, setFeaturesWorking] = useState("Yes");
  const [keysCount, setKeysCount] = useState("Both sets");
  const [result, setResult] = useState(null);
  const [vehiclePhoto, setVehiclePhoto] = useState(null);
  const [phase, setPhase] = useState("vin");
  const [showRecon, setShowRecon] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showRecalls, setShowRecalls] = useState(false);
  const [inGarage, setInGarage] = useState(false);
  const [savingGarage, setSavingGarage] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState(null);
  const [sellProfileOpen, setSellProfileOpen] = useState(false);
  const [exteriorColor, setExteriorColor] = useState("");
  const [interiorColor, setInteriorColor] = useState("");
  const [tireCondition, setTireCondition] = useState("All good");
  const [glassCondition, setGlassCondition] = useState("None");
  const [interiorCleanliness, setInteriorCleanliness] = useState("Clean");
  const [odors, setOdors] = useState("None");
  const [roofType, setRoofType] = useState("Standard");
  const { data: session } = useSession();

  function copyText(text, label) {
    navigator.clipboard?.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  }

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("vin");
    if (v) setVin(v.toUpperCase());
  }, []);

  const cleanVin = vin.trim().toUpperCase();

  async function decodeVin() {
    setError("");
    setDecoded(null);
    if (cleanVin.length !== 17) { setError("VIN must be exactly 17 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${cleanVin}?format=json`);
      const data = await res.json();
      const results = data?.Results || [];
      const vehicle = {
        VIN: cleanVin,
        Make: getVehicleValue(results, 26),
        Model: getVehicleValue(results, 28),
        ModelYear: getVehicleValue(results, 29),
        Trim: getVehicleValue(results, 38),
        BodyClass: getVehicleValue(results, 5),
        EngineCylinders: getVehicleValue(results, 9),
        DriveType: getVehicleValue(results, 15),
        FuelTypePrimary: getVehicleValue(results, 24),
      };
      if (!vehicle.Make && !vehicle.Model) throw new Error("Could not decode this VIN.");
      setDecoded(vehicle);
      setPhase("details");
    } catch (err) {
      setError(err.message || "VIN decode failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runAppraisal() {
    if (!decoded) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        year: decoded.ModelYear, make: decoded.Make, model: decoded.Model,
        trim: decoded.Trim || "", body: decoded.BodyClass || "",
        engine: decoded.EngineCylinders || "", drive: decoded.DriveType || "",
        fuel: decoded.FuelTypePrimary || "",
        zip, mileage, condition, titleStatus, accidents, serviceHistory, owners,
        warningLights, mechanicalIssues, bodyDamage, featuresWorking, keysCount,
      });
      const res = await fetch(`/api/appraise?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setVehiclePhoto(data.vehiclePhoto || null);
      setPhase("results");

      window.dispatchEvent(new CustomEvent("autoiq:appraisal", {
        detail: {
          vin: decoded.VIN, year: decoded.ModelYear, make: decoded.Make,
          model: decoded.Model, trim: decoded.Trim || "",
          bodyClass: decoded.BodyClass || "", driveType: decoded.DriveType || "",
          transmission: decoded.TransmissionStyle || "",
          fuelType: decoded.FuelTypePrimary || "", cylinders: decoded.EngineCylinders || "",
          mileage: String(mileage), condition, zip,
          bodyDamage, mechanicalIssues, warningLights, accidents,
          titleStatus, serviceHistory, owners, keysCount, featuresWorking,
          tradeIn: data.appraisal?.tradeIn, privateParty: data.appraisal?.privateParty,
          retail: data.appraisal?.retail,
        },
      }));

      if (session?.user) {
        const encoded = encodeProfile({
          decoded, mileage, zip, condition, titleStatus, accidents,
          serviceHistory, owners, warningLights, mechanicalIssues,
          bodyDamage, featuresWorking, keysCount,
          appraisal: data.appraisal, recalls: data.recalls ?? [],
          safetyRating: data.safetyRating, marketStats: data.marketStats,
        });
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vin: decoded.VIN, make: decoded.Make, model: decoded.Model,
            year: decoded.ModelYear, trim: decoded.Trim, mileage, condition, zip,
            tradeIn: data.appraisal.tradeIn,
            privateParty: data.appraisal.privateParty,
            retail: data.appraisal.retail,
            profileEncoded: encoded,
          }),
        }).catch(() => {});

        // Check if this VIN is already in the garage so sell links unlock immediately
        fetch("/api/garage")
          .then((r) => r.json())
          .then((d) => {
            const existing = d.cars?.find((c) => c.vin === decoded.VIN);
            if (existing) {
              setInGarage(true);
              // Pre-fill extended sell fields from stored profile if available
              if (existing.profile_encoded) {
                try {
                  const pd = JSON.parse(decodeURIComponent(escape(atob(existing.profile_encoded))));
                  if (pd.ecol) setExteriorColor(pd.ecol);
                  if (pd.icol) setInteriorColor(pd.icol);
                  if (pd.trc)  setTireCondition(pd.trc);
                  if (pd.glc)  setGlassCondition(pd.glc);
                  if (pd.intc) setInteriorCleanliness(pd.intc);
                  if (pd.odo)  setOdors(pd.odo);
                  if (pd.rftp) setRoofType(pd.rftp);
                } catch (_) {}
              }
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Appraisal failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setVin(""); setDecoded(null); setError(""); setResult(null); setPhase("vin");
    setShowRecon(false); setShowListings(false); setShowRecalls(false);
    setWarningLights("None"); setMechanicalIssues("None"); setBodyDamage("None");
    setFeaturesWorking("Yes"); setKeysCount("Both sets");
    setInGarage(false); setSellProfileOpen(false); setVehiclePhoto(null);
    setExteriorColor(""); setInteriorColor(""); setTireCondition("All good");
    setGlassCondition("None"); setInteriorCleanliness("Clean");
    setOdors("None"); setRoofType("Standard");
  }

  async function saveToGarage() {
    if (!decoded || !appraisal) return;
    setSavingGarage(true);
    const encoded = encodeProfile({
      decoded, mileage, zip, condition, titleStatus, accidents,
      serviceHistory, owners, warningLights, mechanicalIssues,
      bodyDamage, featuresWorking, keysCount, appraisal,
      recalls, safetyRating, marketStats,
      exteriorColor, interiorColor, tireCondition, glassCondition,
      interiorCleanliness, odors, roofType, vehiclePhoto,
    });
    await fetch("/api/garage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vin: decoded.VIN, make: decoded.Make, model: decoded.Model,
        year: decoded.ModelYear, trim: decoded.Trim, mileage, condition,
        tradeIn: appraisal.tradeIn, privateParty: appraisal.privateParty,
        retail: appraisal.retail, profileEncoded: encoded,
      }),
    }).catch(() => {});
    setInGarage(true);
    setSavingGarage(false);
    setSellProfileOpen(false);
  }

  const { appraisal, listings, recalls = [], safetyRating, marketStats } = result || {};
  const recallGroups = recalls.length > 0 ? groupRecalls(recalls) : {};
  const uniqueRecallCount = Object.values(recallGroups).flat().length;
  const privateDelta = appraisal ? appraisal.privateParty - appraisal.tradeIn : 0;

  /* ─── shared header ─── */
  const header = (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <Zap className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-semibold">AutoIQ</span>
        </Link>
        <div className="flex items-center gap-2">
          {phase !== "vin" && (
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 rounded-lg text-muted-foreground text-sm">
              <RotateCcw className="h-3.5 w-3.5" /> New
            </Button>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );

  /* ─── section wrapper ─── */
  function Section({ title, label, children, toggle, open, onToggle }) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {(title || toggle) && (
          <button
            onClick={onToggle}
            disabled={!toggle}
            className={`flex w-full items-center justify-between px-5 py-4 text-left ${toggle ? "hover:bg-muted/30 transition-colors" : "cursor-default"}`}
          >
            <div>
              {label && <p className="mb-0.5 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>}
              {title && <p className="text-sm font-semibold">{title}</p>}
            </div>
            {toggle && (open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
          </button>
        )}
        <div className={title || toggle ? "border-t border-border" : ""}>{children}</div>
      </div>
    );
  }

  const EXTERIOR_COLORS = ["White","Black","Silver","Gray","Red","Blue","Green","Brown","Orange","Yellow","Gold","Other"];
  const INTERIOR_COLORS = ["Black","Tan / Beige","Gray","Brown","White","Red","Other"];

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Sell profile modal ── */}
      {sellProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Sell profile</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {decoded?.ModelYear} {decoded?.Make} {decoded?.Model}
                </p>
              </div>
              <button onClick={() => setSellProfileOpen(false)} className="rounded-md p-1.5 hover:bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="max-h-[70vh] overflow-y-auto p-6">
              {/* Existing condition summary */}
              <div className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Condition from appraisal</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    `Body: ${bodyDamage}`,
                    `Mechanical: ${mechanicalIssues}`,
                    warningLights !== "None" ? `Lights: ${warningLights}` : null,
                    `Accidents: ${accidents}`,
                    `Title: ${titleStatus}`,
                    `Service: ${serviceHistory}`,
                    `Owners: ${owners}`,
                    `Keys: ${keysCount}`,
                  ].filter(Boolean).map((s) => (
                    <span key={s} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{s}</span>
                  ))}
                </div>
              </div>

              {/* Extended sell fields */}
              <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Additional details for sell forms</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldLabel label="Exterior color">
                  <Select value={exteriorColor} onValueChange={setExteriorColor}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTERIOR_COLORS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Interior color">
                  <Select value={interiorColor} onValueChange={setInteriorColor}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
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

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-border">
              <Button variant="outline" className="rounded-lg" onClick={() => setSellProfileOpen(false)}>
                Cancel
              </Button>
              <Button disabled={savingGarage} className="flex-1 rounded-lg gap-2" onClick={saveToGarage}>
                {savingGarage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {inGarage ? "Update garage" : "Save to garage"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {header}

      <AnimatePresence mode="wait">

        {/* ── Phase 1: VIN ── */}
        {phase === "vin" && (
          <motion.main key="vin" {...fadeUp} className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-20">
            <div className="w-full max-w-lg">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Full appraisal</p>
              <h1 className="mb-1.5 text-4xl font-bold tracking-tight">What's your car worth?</h1>
              <p className="mb-8 text-sm text-muted-foreground">
                Enter your VIN for a live valuation — trade-in, private party, retail, plus estimated buyer offers.
              </p>
              <div className="flex gap-2.5">
                <Input
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  maxLength={17}
                  placeholder="17-character VIN"
                  className="h-11 rounded-xl font-mono text-sm tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && decodeVin()}
                />
                <Button onClick={decodeVin} disabled={loading} className="h-11 rounded-xl shrink-0 px-5">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decode"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className={cleanVin.length === 17 ? "text-foreground font-medium" : ""}>{cleanVin.length}</span>/17 characters
              </p>
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}
            </div>
          </motion.main>
        )}

        {/* ── Phase 2: Details ── */}
        {phase === "details" && decoded && (
          <motion.main key="details" {...fadeUp} className="mx-auto max-w-6xl px-6 py-14">
            {/* Vehicle confirmed */}
            <div className="mb-10">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Vehicle confirmed</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {decoded.ModelYear} {decoded.Make} {decoded.Model}
                {decoded.Trim && <span className="ml-2 text-xl font-normal text-muted-foreground">{decoded.Trim}</span>}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Add your details for an accurate appraisal.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* VIN data */}
              <div>
                <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">From your VIN</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Body", decoded.BodyClass || "—"],
                    ["Engine", decoded.EngineCylinders ? `${decoded.EngineCylinders} cyl` : "—"],
                    ["Drive", decoded.DriveType || "—"],
                    ["Fuel", decoded.FuelTypePrimary || "—"],
                    ["Trim", decoded.Trim || "—"],
                    ["VIN", decoded.VIN],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border bg-card p-3.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary fields */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Current mileage">
                    <Input value={mileage} onChange={(e) => setMileage(e.target.value)} className="h-10 rounded-lg" />
                  </FieldLabel>
                  <FieldLabel label="ZIP code">
                    <Input value={zip} onChange={(e) => setZip(e.target.value)} className="h-10 rounded-lg" />
                  </FieldLabel>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FieldLabel label="Overall condition">
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Excellent", "Good", "Fair", "Poor"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                  <FieldLabel label="Title status">
                    <Select value={titleStatus} onValueChange={setTitleStatus}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Clean", "Lien", "Rebuilt", "Salvage"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
                </div>
              </div>
            </div>

            {/* Condition detail fields */}
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Condition details</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  These mirror the exact questions CarMax and Carvana ask. Answering now saves time on their sites.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      <SelectItem value="Minor">Minor — runs but has issues</SelectItem>
                      <SelectItem value="Major">Major — unreliable or won't start</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldLabel>
                <FieldLabel label="Exterior / body damage">
                  <Select value={bodyDamage} onValueChange={setBodyDamage}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Minor">Minor — light scratches or dings</SelectItem>
                      <SelectItem value="Moderate">Moderate — dents or paint damage</SelectItem>
                      <SelectItem value="Major">Major — collision or structural</SelectItem>
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

              {error && (
                <div className="mt-5 flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <Button
                onClick={runAppraisal}
                disabled={loading}
                className="mt-5 h-10 rounded-xl px-7 gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                Run Appraisal
              </Button>
            </div>
          </motion.main>
        )}

        {/* ── Phase 3: Results ── */}
        {phase === "results" && appraisal && (
          <motion.main key="results" {...fadeUp} className="mx-auto max-w-6xl px-6 py-14">

            {/* Page header */}
            <div className="mb-8">
              <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Appraisal complete</p>
              <h1 className="text-3xl font-bold tracking-tight">
                {decoded.ModelYear} {decoded.Make} {decoded.Model}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {miles(Number(mileage))} · {condition} · {titleStatus} title · {owners} owner{owners !== "1" ? "s" : ""}
                {accidents === "Yes" ? " · Accident reported" : ""}
              </p>
            </div>

            {/* Vehicle photo */}
            {vehiclePhoto && (
              <div className="mb-8 overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={vehiclePhoto}
                  alt={`${decoded.ModelYear} ${decoded.Make} ${decoded.Model}`}
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Report CTA */}
            {(() => {
              const encoded = encodeProfile({
                decoded, mileage, zip, condition, titleStatus, accidents,
                serviceHistory, owners, warningLights, mechanicalIssues,
                bodyDamage, featuresWorking, keysCount, appraisal,
                recalls, safetyRating, marketStats, vehiclePhoto,
              });
              if (!encoded) return null;
              const profileUrl = `/profile?d=${encoded}`;
              return (
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Seller's report ready</p>
                      <p className="text-xs text-muted-foreground">Share this link with buyers or open it before visiting CarMax / Carvana.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" className="rounded-lg gap-1.5" onClick={() => window.open(profileUrl, "_blank")}>
                      View report <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => navigator.clipboard?.writeText(window.location.origin + profileUrl)}>
                      Copy link
                    </Button>
                    {session?.user && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => setSellProfileOpen(true)}
                      >
                        {inGarage ? "✓ In garage · Update profile" : "Save to garage"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Values ── */}
            <div className="mb-8 overflow-hidden rounded-xl border border-border">
              <div className="grid divide-y divide-border sm:divide-x sm:divide-y-0 sm:grid-cols-3">
                {[
                  { label: "Trade-in / Instant offer", sub: "CarMax, Carvana, dealerships", value: appraisal.tradeIn, range: appraisal.tradeInRange },
                  { label: "Private party", sub: "Facebook Marketplace, Craigslist", value: appraisal.privateParty, range: appraisal.privatePartyRange },
                  { label: "Retail", sub: "What dealers resell it for", value: appraisal.retail, range: appraisal.retailRange },
                ].map(({ label, sub, value, range }) => (
                  <div key={label} className="bg-card p-6">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-3 text-4xl font-bold tracking-tight">{money(value)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{money(range.low)} – {money(range.high)}</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">{sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Quick reference ── */}
            <div className="mb-8 rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Copy before you go</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "VIN", value: decoded?.VIN },
                  { label: "Year / Make / Model", value: `${decoded?.ModelYear} ${decoded?.Make} ${decoded?.Model}${decoded?.Trim ? " " + decoded.Trim : ""}` },
                  { label: "Mileage", value: miles(Number(mileage)) },
                  { label: "Condition", value: condition },
                  { label: "ZIP", value: zip },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => copyText(value, label)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/40"
                  >
                    <span className="text-xs text-muted-foreground">{label}:</span>
                    <span className="font-mono text-xs font-medium">{value}</span>
                    {copiedLabel === label
                      ? <ClipboardCheck className="h-3 w-3 text-foreground" />
                      : <Copy className="h-3 w-3 text-muted-foreground" />
                    }
                  </button>
                ))}
              </div>
              {copiedLabel && <p className="mt-2 text-xs text-muted-foreground">{copiedLabel} copied to clipboard.</p>}
            </div>

            {/* ── Instant buyers ── */}
            <div className="mb-8">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Fastest money</p>
                <h2 className="mt-1 text-xl font-semibold">Instant cash offers</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">These companies buy your car outright — no listing, no waiting.</p>
              </div>
              {!session?.user ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-10 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium">Sign in to see buyer offers</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-xs">See estimated Carvana, CarMax, and CarGurus prices for this exact car.</p>
                  </div>
                  <Button size="sm" className="rounded-lg mt-1" onClick={() => signIn("google")}>Sign in with Google</Button>
                </div>
              ) : !inGarage ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-10 text-center">
                  <Lock className="h-6 w-6 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium">Save this car to unlock buyer offers</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-xs">Saving to your garage unlocks estimated offers from Carvana, CarMax, and 4 other buyers with direct links.</p>
                  </div>
                  <Button size="sm" className="rounded-lg mt-1" onClick={() => setSellProfileOpen(true)}>Save to garage →</Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  {INSTANT_BUYERS.map(({ id, name, tagline, multiplier, spread, getUrl, speed }, i) => {
                    const estimate = Math.round(appraisal.tradeIn * multiplier);
                    const low = Math.round(estimate * (1 - spread / 2));
                    const high = Math.round(estimate * (1 + spread / 2));
                    return (
                      <div key={id} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20 ${i > 0 ? "border-t border-border" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">{tagline} · {speed}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{money(estimate)}</p>
                          <p className="text-xs text-muted-foreground">{money(low)}–{money(high)}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg shrink-0 gap-1.5 text-xs"
                          onClick={() => {
                            copyText(decoded.VIN, "VIN");
                            window.open(getUrl(decoded.VIN), "_blank", "noopener,noreferrer");
                          }}
                        >
                          Get offer <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Private sale ── */}
            {(session?.user && inGarage) && (
              <div className="mb-8">
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Keep more money</p>
                  <h2 className="mt-1 text-xl font-semibold">Sell it yourself</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    More effort, but you keep an extra <span className="font-semibold text-foreground">{money(privateDelta)}</span> on average vs. an instant offer.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border">
                  {PRIVATE_CHANNELS.map(({ id, name, tagline, getUrl, con }, i) => (
                    <div key={id} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20 ${i > 0 ? "border-t border-border" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{tagline}</p>
                        <p className="text-xs text-muted-foreground/60">{con}</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-lg shrink-0 gap-1.5 text-xs" asChild>
                        <a href={getUrl()} target="_blank" rel="noopener noreferrer">
                          List <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Depreciation ── */}
            <div className="mb-8 rounded-xl border border-border bg-card p-5">
              <DepreciationChart retail={appraisal.retail} vehicleYear={decoded.ModelYear} />
            </div>

            {/* ── Worth fixing? ── */}
            {(() => {
              const fixes = [
                warningLights === "Check engine" && {
                  label: "Fix check engine light", repairLow: 150, repairHigh: 500,
                  tradeGain: 400, privateGain: 700, verdict: "worth",
                  note: "Dealers flag lit dash lights immediately — fixing it recovers more than it costs most of the time.",
                },
                warningLights === "Multiple" && {
                  label: "Fix all dashboard lights", repairLow: 500, repairHigh: 1500,
                  tradeGain: 1500, privateGain: 2200, verdict: "worth",
                  note: "Multiple lights signal systemic issues. Addressing them adds significant trust value with any buyer.",
                },
                mechanicalIssues === "Minor" && {
                  label: "Fix minor mechanical issues", repairLow: 300, repairHigh: 800,
                  tradeGain: 600, privateGain: 1000, verdict: "worth",
                  note: "Minor mechanical fixes almost always net more than they cost, especially for private sales.",
                },
                mechanicalIssues === "Major" && {
                  label: "Fix major mechanical issues", repairLow: 1500, repairHigh: 5000,
                  tradeGain: 2000, privateGain: 3500, verdict: "depends",
                  note: "Get a repair quote first. If under $1,500 it's usually worth it. Above that, sell as-is to a specialty buyer like Peddle.",
                },
                bodyDamage === "Minor" && {
                  label: "Fix minor scratches / dings", repairLow: 200, repairHigh: 600,
                  tradeGain: 300, privateGain: 700, verdict: "worth",
                  note: "PDR (paintless dent repair) is cheap and has a strong ROI for private party sales.",
                },
                bodyDamage === "Moderate" && {
                  label: "Fix moderate body damage", repairLow: 800, repairHigh: 2500,
                  tradeGain: 800, privateGain: 1500, verdict: "depends",
                  note: "Get two body shop quotes. If under $1,000 it's likely worth fixing for private sale.",
                },
                bodyDamage === "Major" && {
                  label: "Fix major collision damage", repairLow: 3000, repairHigh: 10000,
                  tradeGain: 2000, privateGain: 4000, verdict: "skip",
                  note: "Repair costs almost always exceed the value recovered. Sell as-is to an instant buyer.",
                },
                featuresWorking === "Minor issues" && {
                  label: "Fix minor electronics / features", repairLow: 100, repairHigh: 400,
                  tradeGain: 200, privateGain: 450, verdict: "worth",
                  note: "Small functional issues are cheap fixes with good ROI.",
                },
                featuresWorking === "Major issues" && {
                  label: "Fix major electronics (AC, infotainment)", repairLow: 500, repairHigh: 2000,
                  tradeGain: 600, privateGain: 1100, verdict: "depends",
                  note: "AC repair is almost always worth it in warm climates. Infotainment less so.",
                },
                keysCount === "One set" && {
                  label: "Get a replacement key / fob", repairLow: 200, repairHigh: 400,
                  tradeGain: 150, privateGain: 300, verdict: "marginal",
                  note: "Marginal for trade-in. Worth doing for private sale where buyers notice the missing set.",
                },
                keysCount === "No keys" && {
                  label: "Get keys made", repairLow: 400, repairHigh: 800,
                  tradeGain: 350, privateGain: 600, verdict: "worth",
                  note: "No-key cars are heavily discounted. Getting keys made almost always pays back.",
                },
              ].filter(Boolean);

              if (!fixes.length) return null;

              const verdictStyle = {
                worth:    { label: "Worth it",    color: "text-emerald-400" },
                depends:  { label: "Case by case", color: "text-amber-400" },
                skip:     { label: "Skip it",      color: "text-red-400" },
                marginal: { label: "Marginal",     color: "text-muted-foreground" },
              };

              return (
                <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Before you sell</p>
                    <p className="mt-0.5 text-sm font-semibold">Worth fixing?</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">ROI estimate for each issue. Repair costs are real-world ranges.</p>
                  </div>
                  <div className="divide-y divide-border">
                    {fixes.map(({ label, repairLow, repairHigh, tradeGain, privateGain, verdict, note }) => {
                      const v = verdictStyle[verdict];
                      return (
                        <div key={label} className="p-5">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{label}</p>
                            <span className={`text-xs font-medium shrink-0 ${v.color}`}>{v.label}</span>
                          </div>
                          <div className="mb-2.5 grid grid-cols-3 gap-2 text-xs">
                            {[
                              ["Repair", `$${repairLow.toLocaleString()}–${repairHigh.toLocaleString()}`],
                              ["Trade gain", `+$${tradeGain.toLocaleString()}`],
                              ["Private gain", `+$${privateGain.toLocaleString()}`],
                            ].map(([lbl, val]) => (
                              <div key={lbl} className="rounded-lg bg-muted px-3 py-2.5">
                                <p className="text-muted-foreground">{lbl}</p>
                                <p className="mt-0.5 font-semibold">{val}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Reconditioning ── */}
            <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setShowRecon((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Reconditioning estimate</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    Est. dealer cost to resell: <span className="text-foreground">{money(appraisal.reconditioning)}</span>
                  </p>
                </div>
                {showRecon ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showRecon && (
                <div className="border-t border-border p-5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Base reconditioning", appraisal.reconditioningBreakdown.base, "Inspection, detail, minor repairs"],
                      ["Mileage wear", appraisal.reconditioningBreakdown.mileage, "Extra wear above 50,000 miles"],
                      ["Accident history", appraisal.reconditioningBreakdown.accident, "Body/paint inspection"],
                      ["Title status", appraisal.reconditioningBreakdown.title, "Documentation and compliance"],
                      ["Service history gap", appraisal.reconditioningBreakdown.service, "Unknown maintenance catch-up"],
                      ["Open recalls", appraisal.reconditioningBreakdown.recalls, "Dealer recall repair liability"],
                      ["Warning lights", appraisal.reconditioningBreakdown.warningLights, "Diagnostic scan and repairs"],
                      ["Mechanical issues", appraisal.reconditioningBreakdown.mechanical, "Repairs to make road-ready"],
                      ["Body damage", appraisal.reconditioningBreakdown.bodyDamage, "Bodywork and paint"],
                      ["Features / electronics", appraisal.reconditioningBreakdown.features, "AC, infotainment, electrical"],
                      ["Missing keys", appraisal.reconditioningBreakdown.keys, "Key programming and replacement"],
                    ].filter(([, value]) => value > 0).map(([label, value, note]) => (
                      <div key={label} className="rounded-lg bg-muted p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm font-semibold">{money(value)}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Adjustments ── */}
            <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">How we adjusted</p>
                <p className="mt-0.5 text-sm font-semibold">Factors applied to market median</p>
              </div>
              <div className="p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Condition", `${appraisal.adjustments.condition >= 0 ? "+" : ""}${appraisal.adjustments.condition}%`, appraisal.adjustments.condition >= 0],
                    ["Title status", `${appraisal.adjustments.title >= 0 ? "+" : ""}${appraisal.adjustments.title}%`, appraisal.adjustments.title >= 0],
                    ["Accident history", `${appraisal.adjustments.accident >= 0 ? "+" : ""}${appraisal.adjustments.accident}%`, appraisal.adjustments.accident >= 0],
                    ["Service history", `${appraisal.adjustments.service >= 0 ? "+" : ""}${appraisal.adjustments.service}%`, appraisal.adjustments.service >= 0],
                    ["Ownership count", `${appraisal.adjustments.owner >= 0 ? "+" : ""}${appraisal.adjustments.owner}%`, appraisal.adjustments.owner >= 0],
                    ...(appraisal.adjustments.recalls !== 0 ? [["Open recalls", `−$${Math.abs(appraisal.adjustments.recalls).toLocaleString()}`, false]] : []),
                    ["Mileage vs comps", `${appraisal.adjustments.mileage >= 0 ? "+" : ""}${money(appraisal.adjustments.mileage)}`, appraisal.adjustments.mileage >= 0],
                  ].map(([label, display, positive]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={`text-sm font-semibold ${positive ? "" : "text-red-400"}`}>{display}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Based on {appraisal.comparables} comparable listings · {appraisal.confidence}% confidence
                </p>
              </div>
            </div>

            {/* ── Safety & Recalls ── */}
            {(safetyRating || recalls.length > 0) && (
              <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-5 flex flex-col gap-6 sm:flex-row sm:items-start">
                  {safetyRating && (
                    <div className="shrink-0">
                      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">NHTSA Safety</p>
                      <p className="mb-2 max-w-[200px] truncate text-xs text-muted-foreground">{safetyRating.description}</p>
                      <div className="mb-3 flex items-center gap-1">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${Number(safetyRating.overall) >= n ? "fill-foreground text-foreground" : "text-muted-foreground/20"}`} />
                        ))}
                        <span className="ml-1.5 text-sm font-semibold">{safetyRating.overall}/5</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[["Front", safetyRating.frontCrash], ["Side", safetyRating.sideCrash], ["Rollover", safetyRating.rollover]].map(([l, v]) => (
                          <div key={l} className="rounded-lg bg-muted p-2">
                            <p className="text-muted-foreground">{l}</p>
                            <p className="font-semibold">{v ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex-1">
                    <button
                      onClick={() => recalls.length > 0 && setShowRecalls((v) => !v)}
                      className="flex w-full items-start justify-between text-left"
                    >
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Open Recalls</p>
                        {recalls.length > 0 ? (
                          <>
                            <div className="mb-2 flex items-center gap-2">
                              <TriangleAlert className="h-4 w-4 text-amber-400" />
                              <span className="text-xl font-bold">
                                {uniqueRecallCount} recall{uniqueRecallCount !== 1 ? "s" : ""}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                (−${Math.min(uniqueRecallCount * 300, 1000).toLocaleString()} applied)
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(recallGroups).map(([cat, items]) => (
                                <span key={cat} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
                                  {cat} ×{items.length}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                            <span className="text-lg font-semibold">No open recalls</span>
                          </div>
                        )}
                      </div>
                      {recalls.length > 0 && (
                        <div className="ml-4 shrink-0 mt-1">
                          {showRecalls ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      )}
                    </button>
                    {showRecalls && recalls.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {Object.entries(recallGroups).map(([cat, items]) => (
                          <div key={cat} className="rounded-lg border border-border p-4">
                            <p className="mb-2 text-sm font-semibold">{cat}</p>
                            {items.map((r) => (
                              <div key={r.campaign} className="mb-2 last:mb-0">
                                <span className="text-xs text-muted-foreground font-mono">{r.campaign}</span>
                                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{r.summary}</p>
                                {r.remedy && <p className="mt-1 text-xs text-emerald-400"><span className="font-medium">Fix:</span> {r.remedy}</p>}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Market conditions ── */}
            {marketStats && (
              <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Market conditions</p>
                  <p className="mt-0.5 text-sm font-semibold">How this car is moving right now</p>
                </div>
                <div className="grid gap-px p-5 sm:grid-cols-4">
                  {[
                    { label: "Active listings", value: marketStats.totalListings?.toLocaleString() ?? "—", note: "within 100 mi" },
                    { label: "Market median", value: marketStats.medianPrice ? `$${marketStats.medianPrice.toLocaleString()}` : "—", note: "asking price" },
                    { label: "Avg mileage", value: marketStats.avgMiles ? `${marketStats.avgMiles.toLocaleString()} mi` : "—", note: "comparable cars" },
                    { label: "Days on market", value: marketStats.avgDaysOnMarket ? `${marketStats.avgDaysOnMarket}d` : "—", note: "before it sells" },
                  ].map(({ label, value, note }) => (
                    <div key={label} className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground/60">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Strategy tips ── */}
            <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Strategy</p>
                <p className="mt-0.5 text-sm font-semibold">How to get the most money</p>
              </div>
              <div className="divide-y divide-border">
                {TIPS.map(([tip, detail]) => (
                  <div key={tip} className="px-5 py-4">
                    <p className="text-sm font-medium">{tip}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Comparable listings ── */}
            <div>
              <button
                onClick={() => setShowListings((v) => !v)}
                className="mb-4 flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Source data</p>
                  <p className="mt-0.5 text-sm font-semibold">{listings.length} comparable listings used</p>
                </div>
                {showListings ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showListings && (
                <div className="overflow-hidden rounded-xl border border-border">
                  {listings.map((item, i) => (
                    <div key={item.id} className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/20 ${i > 0 ? "border-t border-border" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {miles(item.mileage)}
                          {item.location && ` · ${item.location}`}
                          {item.distance && ` · ${item.distance} mi away`}
                          {item.source && ` · ${item.source}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-semibold">{money(item.price)}</p>
                        <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1" asChild>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </motion.main>
        )}

      </AnimatePresence>
    </div>
  );
}
