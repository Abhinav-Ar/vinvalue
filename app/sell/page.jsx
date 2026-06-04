"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Search, Gauge, MapPin, ShieldCheck, AlertTriangle, Loader2,
  ExternalLink, Zap, RotateCcw, Car, Users, Wrench,
  DollarSign, Clock, CheckCircle, TriangleAlert, Star,
} from "lucide-react";
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

function getVehicleValue(results, variableId) {
  const found = results?.find((r) => r.VariableId === variableId);
  return found?.Value || "";
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
        <Icon className="h-4 w-4 text-emerald-400" />
        {label}
      </div>
      {children}
    </label>
  );
}

// Each buyer's estimated offer is tradeIn × multiplier, with a ± spread range
const INSTANT_BUYERS = [
  {
    id: "carvana",
    name: "Carvana",
    tagline: "Online · No store visit",
    multiplier: 1.02,
    spread: 0.07,
    getUrl: (vin) => `https://www.carvana.com/sell-car/${vin}`,
    pros: ["Offer in 2 minutes", "Free vehicle pickup", "7-day price lock"],
    con: "Offer may drop if inspection finds undisclosed issues",
    speed: "Offer in 2 min",
    badge: "Most popular",
    gradient: "from-blue-600 to-cyan-600",
    badgeBg: "bg-blue-950/50 border-blue-800/50 text-blue-400",
  },
  {
    id: "carmax",
    name: "CarMax",
    tagline: "In-person · Instant payment",
    multiplier: 0.97,
    spread: 0.05,
    getUrl: () => "https://www.carmax.com/sell-my-car",
    pros: ["Check or direct deposit same day", "No-haggle pricing", "Accepts high-mileage cars"],
    con: "Must visit a physical store",
    speed: "Same day",
    badge: null,
    gradient: "from-orange-600 to-amber-600",
    badgeBg: null,
  },
  {
    id: "vroom",
    name: "Vroom",
    tagline: "Online · Free pickup",
    multiplier: 1.0,
    spread: 0.08,
    getUrl: () => "https://www.vroom.com/sell",
    pros: ["Fully online process", "Free vehicle pickup"],
    con: "Payment takes 2–5 days · Not all states",
    speed: "2–5 days",
    badge: null,
    gradient: "from-emerald-600 to-teal-600",
    badgeBg: null,
  },
  {
    id: "kbb",
    name: "KBB Instant Cash Offer",
    tagline: "Local dealer network",
    multiplier: 0.95,
    spread: 0.10,
    getUrl: () => "https://www.kbb.com/instant-cash-offer/",
    pros: ["Compare multiple dealer offers", "Can apply to a new car purchase"],
    con: "Offer quality varies heavily by location",
    speed: "Same day",
    badge: null,
    gradient: "from-violet-600 to-purple-600",
    badgeBg: null,
  },
  {
    id: "autonation",
    name: "AutoNation",
    tagline: "Large dealer group · Nationwide",
    multiplier: 0.93,
    spread: 0.08,
    getUrl: () => "https://www.autonation.com/sell-my-car",
    pros: ["Convenient if near a location", "Reputable large chain"],
    con: "Typically lower offers than online buyers",
    speed: "Same day",
    badge: null,
    gradient: "from-rose-600 to-pink-600",
    badgeBg: null,
  },
  {
    id: "peddle",
    name: "Peddle",
    tagline: "Any condition · Free tow",
    multiplier: 0.78,
    spread: 0.12,
    getUrl: () => "https://www.peddle.com/",
    pros: ["Buys non-running and salvage cars", "Free towing included"],
    con: "Lowest offers — best only for damaged or non-running cars",
    speed: "Same day",
    badge: "Best for damaged/non-running",
    gradient: "from-zinc-600 to-slate-600",
    badgeBg: "bg-zinc-900/50 border-zinc-700/50 text-zinc-400",
  },
];

const PRIVATE_CHANNELS = [
  {
    id: "facebook",
    name: "Facebook Marketplace",
    tagline: "Highest price · Largest local pool",
    getUrl: () => "https://www.facebook.com/marketplace/create/vehicle",
    pros: ["No fees", "Largest local buyer pool", "Negotiate for top dollar"],
    con: "Takes days to weeks · Must meet strangers",
    speed: "Days–weeks",
    accentColor: "text-blue-400",
    borderColor: "border-blue-800/40",
    bgColor: "bg-blue-950/15",
  },
  {
    id: "craigslist",
    name: "Craigslist",
    tagline: "Free listing · Cash buyers",
    getUrl: () => "https://www.craigslist.org/about/sites",
    pros: ["Free to list", "Cash deals common"],
    con: "More scam risk than Facebook · No buyer verification",
    speed: "Days–weeks",
    accentColor: "text-amber-400",
    borderColor: "border-amber-800/40",
    bgColor: "bg-amber-950/15",
  },
  {
    id: "autotrader",
    name: "AutoTrader",
    tagline: "Paid listing · Serious buyers",
    getUrl: () => "https://www.autotrader.com/sell-my-car",
    pros: ["Attracts buyers actively shopping", "Broader geographic reach"],
    con: "$49–$99 listing fee · Slower than Marketplace",
    speed: "1–4 weeks",
    accentColor: "text-indigo-400",
    borderColor: "border-indigo-800/40",
    bgColor: "bg-indigo-950/15",
  },
];

const TIPS = [
  ["Get 3+ instant offers first", "Carvana, CarMax, and Vroom quotes are binding for 7 days. Use them as leverage when negotiating with dealers or private buyers."],
  ["Clean the car before any appraisal", "A clean car gets offers $300–$800 higher on average. Detail it before the CarMax visit or before listing photos."],
  ["Have your title ready", "A lien on the title slows everything down. Call your bank first if you're still paying it off."],
  ["Don't mention a trade-in early", "If you're buying another car, negotiate the purchase price before disclosing you have a trade-in."],
];

export default function SellPage() {
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
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("vin");

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

  async function runValuation() {
    if (!decoded) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        year: decoded.ModelYear,
        make: decoded.Make,
        model: decoded.Model,
        trim: decoded.Trim || "",
        body: decoded.BodyClass || "",
        engine: decoded.EngineCylinders || "",
        drive: decoded.DriveType || "",
        fuel: decoded.FuelTypePrimary || "",
        zip,
        mileage,
        condition,
        titleStatus,
        accidents,
        serviceHistory,
        owners,
      });
      const res = await fetch(`/api/appraise?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setPhase("results");
    } catch (err) {
      setError(err.message || "Valuation failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setVin(""); setDecoded(null); setError(""); setResult(null); setPhase("vin");
  }

  const { appraisal, recalls, safetyRating } = result || {};
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
            <Badge className="rounded-full border-emerald-800/50 bg-emerald-950/50 text-emerald-400">
              Sell Your Car
            </Badge>
            {phase !== "vin" && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-2 rounded-xl text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" /> Start over
              </Button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">

        {/* ── Phase 1: VIN ── */}
        {phase === "vin" && (
          <motion.main key="vin" {...fadeUp} className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-20">
            <div className="w-full max-w-2xl">
              <Badge className="mb-6 rounded-full border-emerald-800/50 bg-emerald-950/50 text-emerald-400">
                Compare every buyer in one place
              </Badge>
              <h1 className="mb-3 text-5xl font-bold tracking-tight">
                Where should you{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  sell your car?
                </span>
              </h1>
              <p className="mb-10 text-lg text-muted-foreground">
                Enter your VIN and we'll show you estimated offers from Carvana, CarMax, Vroom, and more — so you know who to approach first.
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
                      className="h-14 rounded-2xl border-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-8 text-base text-white shadow-md shadow-emerald-900/40 hover:from-emerald-700 hover:to-teal-700"
                    >
                      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
                      Compare
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className={cleanVin.length === 17 ? "font-semibold text-emerald-400" : ""}>
                      {cleanVin.length}/17
                    </span>{" "}· No account needed
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">Vehicle confirmed</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
              {decoded.Trim && <span className="ml-3 text-2xl font-medium text-muted-foreground">{decoded.Trim}</span>}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">Tell us about this car to get accurate estimates.</p>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Specs from VIN */}
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

              {/* Details form */}
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

                  {error && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                    </div>
                  )}

                  <Button
                    onClick={runValuation}
                    disabled={loading}
                    className="h-12 rounded-2xl border-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 hover:from-emerald-700 hover:to-teal-700"
                  >
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DollarSign className="mr-2 h-5 w-5" />}
                    See Where to Sell
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.main>
        )}

        {/* ── Phase 3: Results ── */}
        {phase === "results" && appraisal && (
          <motion.main key="results" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">Your market breakdown</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">
              Based on {appraisal.comparables} live listings · {appraisal.confidence}% confidence
            </p>

            {/* Value summary strip */}
            <div className="mb-12 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Instant offer range",
                  value: appraisal.tradeIn,
                  low: appraisal.tradeInRange.low,
                  high: appraisal.tradeInRange.high,
                  gradient: "from-amber-600 to-orange-600",
                  shadow: "shadow-amber-900/30",
                  note: "CarMax, Carvana, Vroom",
                },
                {
                  label: "Private party range",
                  value: appraisal.privateParty,
                  low: appraisal.privatePartyRange.low,
                  high: appraisal.privatePartyRange.high,
                  gradient: "from-indigo-600 to-violet-600",
                  shadow: "shadow-indigo-900/30",
                  note: "Facebook Marketplace, Craigslist",
                },
                {
                  label: "Dealer retail value",
                  value: appraisal.retail,
                  low: appraisal.retailRange.low,
                  high: appraisal.retailRange.high,
                  gradient: "from-emerald-600 to-teal-600",
                  shadow: "shadow-emerald-900/30",
                  note: "What dealers will sell it for",
                },
              ].map(({ label, value, low, high, gradient, shadow, note }) => (
                <Card key={label} className={`overflow-hidden rounded-3xl border-0 shadow-2xl ${shadow}`}>
                  <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
                    <p className="text-sm font-medium text-white/80">{label}</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight">{money(value)}</p>
                    <p className="mt-1 text-sm text-white/60">{money(low)} – {money(high)}</p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-xs text-muted-foreground">{note}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Recalls & safety banner */}
            {(recalls?.length > 0 || safetyRating) && (
              <div className="mb-10 grid gap-4 sm:grid-cols-2">
                {recalls?.length > 0 && (
                  <div className="flex items-start gap-4 rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-300">
                        {recalls.length} open recall{recalls.length !== 1 ? "s" : ""} on this vehicle
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {recalls.map((r) => r.component).join(" · ")}
                      </p>
                      <p className="mt-2 text-xs text-amber-400/80">
                        Buyers will see this. Getting recalls fixed before listing can recover ${Math.min(recalls.length * 300, 1000).toLocaleString()} in value.
                      </p>
                    </div>
                  </div>
                )}
                {safetyRating && (
                  <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                    <Star className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="font-semibold">NHTSA Overall Safety: {safetyRating.overall}/5 stars</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{safetyRating.description}</p>
                      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                        <span>Front {safetyRating.frontCrash}★</span>
                        <span>Side {safetyRating.sideCrash}★</span>
                        <span>Rollover {safetyRating.rollover}★</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Instant buyers */}
            <div className="mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-500">Fastest money</p>
              <h2 className="mb-2 text-2xl font-bold">Get an instant cash offer</h2>
              <p className="mb-6 text-muted-foreground">
                These companies buy your car outright — no listing, no waiting. Click to get your actual offer.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {INSTANT_BUYERS.map(({ id, name, tagline, multiplier, spread, getUrl, pros, con, speed, badge, gradient, badgeBg }) => {
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
                            <Clock className="h-3 w-3" />
                            {speed}
                          </div>
                        </div>
                        {badge && (
                          <Badge className={`mb-3 rounded-full text-xs ${badgeBg}`}>{badge}</Badge>
                        )}
                        <p className="text-2xl font-bold">{money(estimate)}</p>
                        <p className="text-sm text-white/60">{money(low)} – {money(high)} estimated</p>
                      </div>
                      <CardContent className="p-5">
                        <ul className="mb-4 space-y-1.5">
                          {pros.map((p) => (
                            <li key={p} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              {p}
                            </li>
                          ))}
                          <li className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-0.5 shrink-0 text-xs text-red-400">✕</span>
                            {con}
                          </li>
                        </ul>
                        <Button
                          className={`w-full rounded-2xl border-0 bg-gradient-to-r ${gradient} text-white`}
                          asChild
                        >
                          <a href={getUrl(decoded.VIN)} target="_blank" rel="noopener noreferrer">
                            Get {name.split(" ")[0]} Offer <ExternalLink className="ml-2 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Private sale channels */}
            <div className="mb-12">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Keep more money</p>
              <h2 className="mb-2 text-2xl font-bold">Sell it yourself</h2>
              <p className="mb-6 text-muted-foreground">
                Takes more effort, but you pocket an extra{" "}
                <span className="font-semibold text-foreground">{money(privateDelta)}</span>{" "}
                on average vs. an instant offer.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                {PRIVATE_CHANNELS.map(({ id, name, tagline, getUrl, pros, con, speed, accentColor, borderColor, bgColor }) => (
                  <Card key={id} className={`overflow-hidden rounded-3xl border ${borderColor} ${bgColor}`}>
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <h3 className={`text-lg font-bold ${accentColor}`}>{name}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{tagline}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{speed}</p>
                      </div>
                      <ul className="mb-4 space-y-1.5">
                        {pros.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            {p}
                          </li>
                        ))}
                        <li className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-0.5 shrink-0 text-xs text-red-400">✕</span>
                          {con}
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

            {/* Strategy tips */}
            <Card className="rounded-3xl border-border">
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
          </motion.main>
        )}

      </AnimatePresence>
    </div>
  );
}
