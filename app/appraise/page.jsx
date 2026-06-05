"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Search, Gauge, MapPin, ShieldCheck, AlertTriangle, Loader2,
  ExternalLink, Zap, RotateCcw, Car, Users, Wrench,
  DollarSign, ChevronDown, ChevronUp, Star, TriangleAlert,
  Clock, BarChart2, CheckCircle, FileText, Copy, ClipboardCheck,
} from "lucide-react";
import { encodeProfile } from "@/lib/profileEncoding";
import { useSession } from "next-auth/react";
import UserMenu from "@/components/UserMenu";
import DepreciationChart from "@/components/DepreciationChart";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

// Group raw recall list into unique campaigns, categorised by primary component
function groupRecalls(recalls) {
  const seen = new Set();
  const unique = recalls.filter((r) => {
    if (seen.has(r.campaign)) return false;
    seen.add(r.campaign);
    return true;
  });

  const groups = {};
  for (const r of unique) {
    const cat = (r.component?.split(":")?.[0] || "Other")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  }
  return groups; // { "Air Bags": [...], "Exterior Lighting": [...] }
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35 },
};

function FieldLabel({ icon: Icon, label, children }) {
  return (
    <label className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-indigo-400" />
        {label}
      </div>
      {children}
    </label>
  );
}

const INSTANT_BUYERS = [
  {
    id: "carvana",
    name: "Carvana",
    tagline: "Online · No store visit",
    multiplier: 1.02,
    spread: 0.07,
    getUrl: () => "https://www.carvana.com/sell-my-car",
    pros: ["Offer in 2 minutes", "Free vehicle pickup", "7-day price lock"],
    con: "Offer may drop if inspection finds undisclosed issues",
    speed: "2 min",
    badge: "Most popular",
    gradient: "from-blue-600 to-cyan-600",
  },
  {
    id: "carmax",
    name: "CarMax",
    tagline: "In-person · Instant payment",
    multiplier: 0.97,
    spread: 0.05,
    getUrl: (vin) => `https://www.carmax.com/sell-my-car?vin=${vin}`,
    pros: ["Check or deposit same day", "No-haggle pricing", "Accepts high mileage"],
    con: "Must visit a physical store",
    speed: "Same day",
    badge: null,
    gradient: "from-orange-600 to-amber-600",
  },
  {
    id: "cargurus",
    name: "CarGurus",
    tagline: "Online · Dealer network offer",
    multiplier: 0.99,
    spread: 0.08,
    getUrl: () => "https://www.cargurus.com/sell/",
    pros: ["Instant Max Offer from local dealers", "Free pickup available", "Large buyer network"],
    con: "Offer quality varies by your local dealer market",
    speed: "Same day",
    badge: null,
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    id: "kbb",
    name: "KBB Cash Offer",
    tagline: "Local dealer network",
    multiplier: 0.95,
    spread: 0.10,
    getUrl: () => "https://www.kbb.com/instant-cash-offer/",
    pros: ["Compare multiple dealer offers", "Can apply to a new car purchase"],
    con: "Varies heavily by location",
    speed: "Same day",
    badge: null,
    gradient: "from-violet-600 to-purple-600",
  },
  {
    id: "autonation",
    name: "AutoNation",
    tagline: "Large dealer group · Nationwide",
    multiplier: 0.93,
    spread: 0.08,
    getUrl: () => "https://www.autonation.com/sell-my-car",
    pros: ["Convenient if near a location", "Reputable large chain"],
    con: "Typically lower than online buyers",
    speed: "Same day",
    badge: null,
    gradient: "from-rose-600 to-pink-600",
  },
  {
    id: "peddle",
    name: "Peddle",
    tagline: "Any condition · Free tow",
    multiplier: 0.78,
    spread: 0.12,
    getUrl: () => "https://www.peddle.com/",
    pros: ["Buys non-running and salvage", "Free towing"],
    con: "Lowest offers of any buyer",
    speed: "Same day",
    badge: "Best for damaged/non-running",
    gradient: "from-zinc-600 to-slate-600",
  },
];

const PRIVATE_CHANNELS = [
  {
    id: "facebook",
    name: "Facebook Marketplace",
    tagline: "Highest price · Largest local pool",
    getUrl: () => "https://www.facebook.com/marketplace/create/vehicle",
    pros: ["No fees", "Biggest local audience", "Negotiate for top dollar"],
    con: "Days to weeks · Must meet strangers",
  },
  {
    id: "craigslist",
    name: "Craigslist",
    tagline: "Free listing · Cash buyers",
    getUrl: () => "https://www.craigslist.org/about/sites",
    pros: ["Free to list", "Cash deals common"],
    con: "More scam risk · No buyer verification",
  },
  {
    id: "autotrader",
    name: "AutoTrader",
    tagline: "Paid listing · Serious buyers",
    getUrl: () => "https://www.autotrader.com/sell-my-car",
    pros: ["Active shoppers only", "Broader than local"],
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
  // Extended condition fields — mirrors what CarMax & Carvana ask
  const [warningLights, setWarningLights] = useState("None");
  const [mechanicalIssues, setMechanicalIssues] = useState("None");
  const [bodyDamage, setBodyDamage] = useState("None");
  const [featuresWorking, setFeaturesWorking] = useState("Yes");
  const [keysCount, setKeysCount] = useState("Both sets");
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("vin");
  const [showRecon, setShowRecon] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showRecalls, setShowRecalls] = useState(false);
  const [inGarage, setInGarage] = useState(false);
  const [savingGarage, setSavingGarage] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState(null);
  const { data: session } = useSession();

  function copyText(text, label) {
    navigator.clipboard?.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  }

  // Pre-fill VIN if arriving from /garage re-appraise link
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
      setPhase("results");

      // Send data to the AutoIQ browser extension if installed
      window.dispatchEvent(new CustomEvent("autoiq:appraisal", {
        detail: {
          vin: decoded.VIN,
          year: decoded.ModelYear,
          make: decoded.Make,
          model: decoded.Model,
          trim: decoded.Trim || "",
          mileage: String(mileage),
          condition,
          zip,
          tradeIn: data.appraisal?.tradeIn,
          privateParty: data.appraisal?.privateParty,
          retail: data.appraisal?.retail,
        },
      }));

      // Auto-save to history if signed in (fire-and-forget)
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
    setInGarage(false);
  }

  const { appraisal, listings, recalls = [], safetyRating, marketStats } = result || {};
  const recallGroups = recalls.length > 0 ? groupRecalls(recalls) : {};
  const uniqueRecallCount = Object.values(recallGroups).flat().length;
  const privateDelta = appraisal ? appraisal.privateParty - appraisal.tradeIn : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight transition-colors group-hover:text-indigo-400">AutoIQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">Full Appraisal</Badge>
            {phase !== "vin" && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-2 rounded-xl text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" /> New appraisal
              </Button>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">

        {/* ── Phase 1: VIN ── */}
        {phase === "vin" && (
          <motion.main key="vin" {...fadeUp} className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-20">
            <div className="w-full max-w-2xl">
              <Badge className="mb-6 rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">
                Value · Compare buyers · Sell
              </Badge>
              <h1 className="mb-3 text-5xl font-bold tracking-tight">
                What is your car{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  actually worth?
                </span>
              </h1>
              <p className="mb-10 text-lg text-muted-foreground">
                Get your trade-in, private party, and retail values — then see estimated offers from Carvana, CarMax, CarGurus, and more, all in one place.
              </p>
              <Card className="rounded-3xl border-border shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      maxLength={17}
                      placeholder="Enter 17-character VIN"
                      className="h-14 rounded-2xl text-lg tracking-widest"
                      onKeyDown={(e) => e.key === "Enter" && decodeVin()}
                    />
                    <Button
                      onClick={decodeVin}
                      disabled={loading}
                      className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-8 text-base text-white shadow-md shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
                    >
                      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                      Start
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className={cleanVin.length === 17 ? "font-semibold text-emerald-400" : ""}>{cleanVin.length}/17</span>
                    {" "}
                  </p>
                  {error && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.main>
        )}

        {/* ── Phase 2: Details ── */}
        {phase === "details" && decoded && (
          <motion.main key="details" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Vehicle confirmed</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
              {decoded.Trim && <span className="ml-3 text-2xl font-medium text-muted-foreground">{decoded.Trim}</span>}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">Tell us about this specific car to get an accurate appraisal.</p>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">From your VIN</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Body", decoded.BodyClass || "—"],
                    ["Engine", decoded.EngineCylinders ? `${decoded.EngineCylinders} cyl` : "—"],
                    ["Drive", decoded.DriveType || "—"],
                    ["Fuel", decoded.FuelTypePrimary || "—"],
                    ["Trim", decoded.Trim || "—"],
                    ["VIN", decoded.VIN],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="rounded-3xl border-border">
                <CardContent className="grid gap-5 p-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FieldLabel icon={Gauge} label="Current mileage">
                      <Input value={mileage} onChange={(e) => setMileage(e.target.value)} className="h-11 rounded-2xl" />
                    </FieldLabel>
                    <FieldLabel icon={MapPin} label="ZIP code">
                      <Input value={zip} onChange={(e) => setZip(e.target.value)} className="h-11 rounded-2xl" />
                    </FieldLabel>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FieldLabel icon={ShieldCheck} label="Condition">
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Excellent", "Good", "Fair", "Poor"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldLabel>
                    <FieldLabel icon={Car} label="Title status">
                      <Select value={titleStatus} onValueChange={setTitleStatus}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Clean", "Lien", "Rebuilt", "Salvage"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldLabel>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <FieldLabel icon={AlertTriangle} label="Accidents">
                      <Select value={accidents} onValueChange={setAccidents}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No">None</SelectItem>
                          <SelectItem value="Yes">Reported</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldLabel>
                    <FieldLabel icon={Wrench} label="Service history">
                      <Select value={serviceHistory} onValueChange={setServiceHistory}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full dealer">Full dealer</SelectItem>
                          <SelectItem value="Full independent">Full independent</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="None">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldLabel>
                    <FieldLabel icon={Users} label="Owners">
                      <Select value={owners} onValueChange={setOwners}>
                        <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 owner</SelectItem>
                          <SelectItem value="2">2 owners</SelectItem>
                          <SelectItem value="3">3+ owners</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldLabel>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Condition details — full width, mirrors CarMax / Carvana questions */}
            <Card className="mt-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Condition details</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These are the exact questions CarMax and Carvana ask. Answering now gives you a more accurate estimate and saves time on their sites.
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <FieldLabel icon={AlertTriangle} label="Warning lights on dash">
                    <Select value={warningLights} onValueChange={setWarningLights}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Check engine">Check engine light</SelectItem>
                        <SelectItem value="Multiple">Multiple lights</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={Wrench} label="Mechanical issues">
                    <Select value={mechanicalIssues} onValueChange={setMechanicalIssues}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None — runs great</SelectItem>
                        <SelectItem value="Minor">Minor — runs but has issues</SelectItem>
                        <SelectItem value="Major">Major — unreliable or won't start</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={Car} label="Exterior / body damage">
                    <Select value={bodyDamage} onValueChange={setBodyDamage}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Minor">Minor — light scratches or dings</SelectItem>
                        <SelectItem value="Moderate">Moderate — dents or paint damage</SelectItem>
                        <SelectItem value="Major">Major — collision or structural</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={ShieldCheck} label="Features & electronics">
                    <Select value={featuresWorking} onValueChange={setFeaturesWorking}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">All working — AC, windows, infotainment</SelectItem>
                        <SelectItem value="Minor issues">Minor issues — one or two small things</SelectItem>
                        <SelectItem value="Major issues">Major issues — AC, sunroof, or electronics out</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={Search} label="Keys / remotes available">
                    <Select value={keysCount} onValueChange={setKeysCount}>
                      <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Both sets">Both sets</SelectItem>
                        <SelectItem value="One set">One set only</SelectItem>
                        <SelectItem value="No keys">No keys</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>
                </div>

                {error && (
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                  </div>
                )}

                <Button
                  onClick={runAppraisal}
                  disabled={loading}
                  className="mt-6 h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700 sm:w-auto sm:px-10"
                >
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DollarSign className="mr-2 h-5 w-5" />}
                  Run Full Appraisal
                </Button>
              </CardContent>
            </Card>
          </motion.main>
        )}

        {/* ── Phase 3: Results ── */}
        {phase === "results" && appraisal && (
          <motion.main key="results" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Appraisal complete</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
            </h1>
            <p className="mb-6 text-lg text-muted-foreground">
              {miles(Number(mileage))} · {condition} · {titleStatus} title · {owners} owner{owners !== "1" ? "s" : ""}
              {accidents === "Yes" ? " · Accident reported" : ""}
            </p>

            {/* Share / profile CTA */}
            {(() => {
              const encoded = encodeProfile({
                decoded, mileage, zip, condition, titleStatus, accidents,
                serviceHistory, owners, warningLights, mechanicalIssues,
                bodyDamage, featuresWorking, keysCount, appraisal,
                recalls, safetyRating, marketStats,
              });
              if (!encoded) return null;
              const profileUrl = `/profile?d=${encoded}`;
              return (
                <div className="mb-12 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-800/40 bg-indigo-950/20 px-5 py-4">
                  <FileText className="h-5 w-5 shrink-0 text-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Your seller's report is ready</p>
                    <p className="text-xs text-muted-foreground">Share this link with buyers, or open it before visiting CarMax / Carvana so you have all your answers ready.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                      onClick={() => window.open(profileUrl, "_blank")}
                    >
                      View Report <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => navigator.clipboard?.writeText(window.location.origin + profileUrl)}
                    >
                      Copy link
                    </Button>
                    {session?.user && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingGarage}
                        className={`rounded-xl ${inGarage ? "border-violet-700 text-violet-400" : ""}`}
                        onClick={async () => {
                          setSavingGarage(true);
                          await fetch("/api/garage", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              vin: decoded.VIN, make: decoded.Make, model: decoded.Model,
                              year: decoded.ModelYear, trim: decoded.Trim, mileage, condition,
                              tradeIn: appraisal.tradeIn, privateParty: appraisal.privateParty,
                              retail: appraisal.retail, profileEncoded: encoded,
                            }),
                          });
                          setInGarage(true);
                          setSavingGarage(false);
                        }}
                      >
                        {inGarage ? "✓ In Garage" : "Save to Garage"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Value summary ── */}
            <div className="mb-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Trade-in / Instant offer", sublabel: "CarMax, Carvana, dealership", value: appraisal.tradeIn, range: appraisal.tradeInRange, gradient: "from-amber-600 to-orange-600", shadow: "shadow-amber-900/30", badge: "Lowest" },
                { label: "Private party", sublabel: "Facebook Marketplace, Craigslist", value: appraisal.privateParty, range: appraisal.privatePartyRange, gradient: "from-indigo-600 to-violet-600", shadow: "shadow-indigo-900/30", badge: "Most common" },
                { label: "Retail / Consignment", sublabel: "What dealers sell it for", value: appraisal.retail, range: appraisal.retailRange, gradient: "from-emerald-600 to-teal-600", shadow: "shadow-emerald-900/30", badge: "Highest" },
              ].map(({ label, sublabel, value, range, gradient, shadow, badge }) => (
                <Card key={label} className={`overflow-hidden rounded-3xl border-0 shadow-2xl ${shadow}`}>
                  <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
                    <Badge className="mb-3 rounded-full border-white/20 bg-white/15 text-white text-xs">{badge}</Badge>
                    <p className="text-sm font-medium text-white/80">{label}</p>
                    <p className="mt-1 text-4xl font-bold tracking-tight">{money(value)}</p>
                    <p className="mt-1 text-sm text-white/60">{money(range.low)} – {money(range.high)}</p>
                  </div>
                  <div className="bg-card p-4">
                    <p className="text-xs text-muted-foreground">{sublabel}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* ── Instant offer companies ── */}
            <div className="mb-10">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">Fastest money</p>
              <h2 className="mb-2 text-2xl font-bold">Get an instant cash offer</h2>
              <p className="mb-4 text-muted-foreground">These companies buy your car outright — no listing, no waiting. Click to get your actual offer.</p>

              {/* Quick Reference — copy key details before visiting each site */}
              <Card className="mb-6 rounded-2xl border-border bg-muted/30">
                <CardContent className="p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your info — copy before you go</p>
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
                        className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-indigo-500 hover:bg-indigo-950/30"
                      >
                        <span className="text-xs text-muted-foreground">{label}:</span>
                        <span className="font-mono font-medium">{value}</span>
                        {copiedLabel === label
                          ? <ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />
                          : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </button>
                    ))}
                  </div>
                  {copiedLabel && (
                    <p className="mt-2 text-xs text-emerald-400">{copiedLabel} copied — paste it when prompted on their site.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {INSTANT_BUYERS.map(({ id, name, tagline, multiplier, spread, getUrl, pros, con, speed, badge, gradient }) => {
                  const estimate = Math.round(appraisal.tradeIn * multiplier);
                  const low = Math.round(estimate * (1 - spread / 2));
                  const high = Math.round(estimate * (1 + spread / 2));
                  return (
                    <Card key={id} className="overflow-hidden rounded-3xl border-border">
                      <div className={`bg-gradient-to-br ${gradient} p-5 text-white`}>
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold">{name}</h3>
                            <p className="text-sm text-white/70">{tagline}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-xs">
                            <Clock className="h-3 w-3" />{speed}
                          </div>
                        </div>
                        {badge && <Badge className="mb-3 rounded-full border-white/20 bg-white/15 text-white text-xs">{badge}</Badge>}
                        <p className="text-2xl font-bold">{money(estimate)}</p>
                        <p className="text-sm text-white/60">{money(low)} – {money(high)} est.</p>
                      </div>
                      <CardContent className="p-5">
                        <ul className="mb-4 space-y-1.5">
                          {pros.map((p) => (
                            <li key={p} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{p}
                            </li>
                          ))}
                          <li className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5 shrink-0 text-xs text-red-400">✕</span>{con}
                          </li>
                        </ul>
                        <Button
                          className={`w-full rounded-2xl border-0 bg-gradient-to-r ${gradient} text-white`}
                          onClick={() => {
                            copyText(decoded.VIN, "VIN");
                            window.open(getUrl(decoded.VIN), "_blank", "noopener,noreferrer");
                          }}
                        >
                          Get {name.split(" ")[0]} Offer <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* ── Private sale channels ── */}
            <div className="mb-10">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Keep more money</p>
              <h2 className="mb-2 text-2xl font-bold">Sell it yourself</h2>
              <p className="mb-6 text-muted-foreground">
                More effort, but you pocket an extra{" "}
                <span className="font-semibold text-foreground">{money(privateDelta)}</span> on average vs. an instant offer.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {PRIVATE_CHANNELS.map(({ id, name, tagline, getUrl, pros, con }) => (
                  <Card key={id} className="rounded-3xl border-border">
                    <CardContent className="p-5">
                      <h3 className="mb-0.5 text-lg font-bold">{name}</h3>
                      <p className="mb-4 text-xs text-muted-foreground">{tagline}</p>
                      <ul className="mb-4 space-y-1.5">
                        {pros.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{p}
                          </li>
                        ))}
                        <li className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-0.5 shrink-0 text-xs text-red-400">✕</span>{con}
                        </li>
                      </ul>
                      <Button variant="outline" className="w-full rounded-2xl" asChild>
                        <a href={getUrl()} target="_blank" rel="noopener noreferrer">
                          List on {name.split(" ")[0]} <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* ── Depreciation projection ── */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <DepreciationChart retail={appraisal.retail} vehicleYear={decoded.ModelYear} />
              </CardContent>
            </Card>

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
                  note: "Get two body shop quotes. If under $1,000 it's likely worth fixing for private sale. Dealers often price this in regardless.",
                },
                bodyDamage === "Major" && {
                  label: "Fix major collision damage", repairLow: 3000, repairHigh: 10000,
                  tradeGain: 2000, privateGain: 4000, verdict: "skip",
                  note: "Repair costs almost always exceed the value recovered. Sell as-is to an instant buyer or specialty buyer.",
                },
                featuresWorking === "Minor issues" && {
                  label: "Fix minor electronics / features", repairLow: 100, repairHigh: 400,
                  tradeGain: 200, privateGain: 450, verdict: "worth",
                  note: "Small functional issues like a stuck window or broken AC vent are cheap fixes with good ROI.",
                },
                featuresWorking === "Major issues" && {
                  label: "Fix major electronics (AC, infotainment)", repairLow: 500, repairHigh: 2000,
                  tradeGain: 600, privateGain: 1100, verdict: "depends",
                  note: "AC repair is almost always worth it in warm climates — buyers heavily discount no-AC cars. Infotainment less so.",
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
                worth: { label: "Worth it", color: "border-emerald-800/50 bg-emerald-950/50 text-emerald-400" },
                depends: { label: "Case by case", color: "border-amber-800/50 bg-amber-950/50 text-amber-400" },
                skip: { label: "Skip it", color: "border-red-800/50 bg-red-950/50 text-red-400" },
                marginal: { label: "Marginal", color: "border-zinc-700/50 bg-zinc-900/50 text-zinc-400" },
              };

              return (
                <Card className="mb-8 rounded-3xl border-border">
                  <CardContent className="p-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-500">Before you sell</p>
                    <h2 className="mb-2 text-xl font-bold">Worth fixing?</h2>
                    <p className="mb-5 text-sm text-muted-foreground">ROI estimate for each issue on your car. Repair costs are real-world ranges, not dealer markup.</p>
                    <div className="space-y-3">
                      {fixes.map(({ label, repairLow, repairHigh, tradeGain, privateGain, verdict, note }) => {
                        const v = verdictStyle[verdict];
                        return (
                          <div key={label} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                              <p className="font-semibold text-sm">{label}</p>
                              <Badge className={`rounded-full border text-xs shrink-0 ${v.color}`}>{v.label}</Badge>
                            </div>
                            <div className="mb-2 grid grid-cols-3 gap-3 text-xs">
                              <div className="rounded-xl bg-background p-2.5">
                                <p className="text-muted-foreground">Repair cost</p>
                                <p className="font-semibold">${repairLow.toLocaleString()}–${repairHigh.toLocaleString()}</p>
                              </div>
                              <div className="rounded-xl bg-background p-2.5">
                                <p className="text-muted-foreground">Trade-in gain</p>
                                <p className="font-semibold text-amber-400">+${tradeGain.toLocaleString()}</p>
                              </div>
                              <div className="rounded-xl bg-background p-2.5">
                                <p className="text-muted-foreground">Private gain</p>
                                <p className="font-semibold text-indigo-400">+${privateGain.toLocaleString()}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* ── Reconditioning breakdown ── */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <button onClick={() => setShowRecon((v) => !v)} className="flex w-full items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Reconditioning estimate</p>
                    <h2 className="mt-1 text-xl font-bold">
                      Est. dealer cost to resell:{" "}
                      <span className="text-amber-400">{money(appraisal.reconditioning)}</span>
                    </h2>
                  </div>
                  {showRecon ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </button>
                {showRecon && (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {[
                      ["Base reconditioning", appraisal.reconditioningBreakdown.base, "Inspection, detail, minor repairs"],
                      ["Mileage wear", appraisal.reconditioningBreakdown.mileage, "Extra wear above 50,000 miles"],
                      ["Accident history", appraisal.reconditioningBreakdown.accident, "Body/paint inspection and repairs"],
                      ["Title status", appraisal.reconditioningBreakdown.title, "Documentation and compliance costs"],
                      ["Service history gap", appraisal.reconditioningBreakdown.service, "Unknown maintenance catch-up"],
                      ["Open recalls", appraisal.reconditioningBreakdown.recalls, "Dealer recall repair time and liability"],
                      ["Warning lights", appraisal.reconditioningBreakdown.warningLights, "Diagnostic scan and repairs"],
                      ["Mechanical issues", appraisal.reconditioningBreakdown.mechanical, "Repairs to make road-ready"],
                      ["Body damage", appraisal.reconditioningBreakdown.bodyDamage, "Bodywork, paint, or structural repair"],
                      ["Features / electronics", appraisal.reconditioningBreakdown.features, "AC, infotainment, or electrical repairs"],
                      ["Missing keys", appraisal.reconditioningBreakdown.keys, "Key programming and replacement"],
                    ].map(([label, value, note]) => (
                      value > 0 && (
                        <div key={label} className="rounded-2xl bg-card p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-sm font-bold text-amber-400">{money(value)}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Adjustments applied ── */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-indigo-500">How we adjusted</p>
                <h2 className="mb-5 text-xl font-bold">Factors applied to market median</h2>
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
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className={`text-sm font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>{display}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Based on {appraisal.comparables} comparable listings · {appraisal.confidence}% confidence
                </p>
              </CardContent>
            </Card>

            {/* ── Safety & Recalls ── */}
            {(safetyRating || recalls.length > 0) && (
              <Card className="mb-8 rounded-3xl border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-8 sm:flex-row sm:items-start">

                    {/* NCAP rating */}
                    {safetyRating && (
                      <div className="shrink-0">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">NHTSA Safety</p>
                        <p className="mb-2 max-w-[200px] truncate text-xs text-muted-foreground">{safetyRating.description}</p>
                        <div className="mb-3 flex items-center gap-1">
                          {[1,2,3,4,5].map((n) => (
                            <Star key={n} className={`h-5 w-5 ${Number(safetyRating.overall) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
                          ))}
                          <span className="ml-2 text-sm font-bold">{safetyRating.overall}/5</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {[["Front", safetyRating.frontCrash], ["Side", safetyRating.sideCrash], ["Rollover", safetyRating.rollover]].map(([l, v]) => (
                            <div key={l} className="rounded-xl bg-card p-2">
                              <p className="text-muted-foreground">{l}</p>
                              <p className="font-bold">{v ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recalls */}
                    <div className="flex-1">
                      <button
                        onClick={() => recalls.length > 0 && setShowRecalls((v) => !v)}
                        className="flex w-full items-start justify-between text-left"
                      >
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Open Recalls</p>
                          {recalls.length > 0 ? (
                            <>
                              <div className="mb-3 flex items-center gap-2">
                                <TriangleAlert className="h-4 w-4 text-amber-400" />
                                <span className="text-xl font-bold">
                                  {uniqueRecallCount} recall{uniqueRecallCount !== 1 ? "s" : ""}
                                </span>
                                <span className="text-base font-medium text-amber-400">
                                  (−${Math.min(uniqueRecallCount * 300, 1000).toLocaleString()} applied)
                                </span>
                              </div>
                              {/* Component category pills */}
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(recallGroups).map(([cat, items]) => (
                                  <span key={cat} className="rounded-full border border-amber-800/40 bg-amber-950/30 px-3 py-1 text-xs text-amber-300">
                                    {cat} ×{items.length}
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-400" />
                              <span className="text-xl font-bold text-emerald-400">No open recalls</span>
                            </div>
                          )}
                        </div>
                        {recalls.length > 0 && (
                          <div className="ml-4 shrink-0 mt-1">
                            {showRecalls ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                          </div>
                        )}
                      </button>

                      {showRecalls && recalls.length > 0 && (
                        <div className="mt-5 space-y-3">
                          {Object.entries(recallGroups).map(([cat, items]) => (
                            <div key={cat} className="rounded-2xl border border-amber-900/40 bg-amber-950/15 p-4">
                              <p className="mb-2 text-sm font-semibold text-amber-300">{cat}</p>
                              {items.map((r) => (
                                <div key={r.campaign} className="mb-2 last:mb-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <Badge className="rounded-full border-amber-800/50 bg-amber-950/50 text-amber-400 text-xs">{r.campaign}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{r.summary}</p>
                                  {r.remedy && (
                                    <p className="mt-1 text-xs text-emerald-400"><span className="font-medium">Fix:</span> {r.remedy}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Market conditions ── */}
            {marketStats && (
              <Card className="mb-8 rounded-3xl border-border">
                <CardContent className="p-6">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-indigo-500">Market conditions</p>
                  <h2 className="mb-5 text-xl font-bold">How this car is moving right now</h2>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { icon: BarChart2, label: "Active listings", value: marketStats.totalListings?.toLocaleString() ?? "—", note: "within 100 mi" },
                      { icon: DollarSign, label: "Market median", value: marketStats.medianPrice ? `$${marketStats.medianPrice.toLocaleString()}` : "—", note: "asking price" },
                      { icon: Gauge, label: "Avg mileage", value: marketStats.avgMiles ? `${marketStats.avgMiles.toLocaleString()} mi` : "—", note: "comparable cars" },
                      { icon: Clock, label: "Avg days on market", value: marketStats.avgDaysOnMarket ? `${marketStats.avgDaysOnMarket}d` : "—", note: "before it sells" },
                    ].map(({ icon: Icon, label, value, note }) => (
                      <div key={label} className="rounded-2xl bg-card p-4">
                        <Icon className="mb-2 h-4 w-4 text-indigo-400" />
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground/60">{note}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Strategy tips ── */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-emerald-500">Strategy</p>
                <h2 className="mb-5 text-xl font-bold">How to get the most money</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {TIPS.map(([tip, detail]) => (
                    <div key={tip} className="rounded-2xl bg-card p-4">
                      <p className="mb-1 text-sm font-semibold">{tip}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{detail}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Comparable listings ── */}
            <div>
              <button
                onClick={() => setShowListings((v) => !v)}
                className="mb-4 flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Source data</p>
                  <h2 className="mt-1 text-xl font-bold">{listings.length} comparable listings used</h2>
                </div>
                {showListings ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>
              {showListings && (
                <div className="grid gap-3">
                  {listings.map((item) => (
                    <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-indigo-800/60 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {miles(item.mileage)}
                          {item.location && ` · ${item.location}`}
                          {item.distance && ` · ${item.distance} mi away`}
                          {item.source && ` · ${item.source}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:shrink-0">
                        <p className="text-xl font-bold text-emerald-400">{money(item.price)}</p>
                        <Button variant="outline" size="sm" className="rounded-xl" asChild>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            View <ExternalLink className="ml-1.5 h-3 w-3" />
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
