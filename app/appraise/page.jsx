"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Search, Gauge, MapPin, ShieldCheck, AlertTriangle, Loader2,
  ExternalLink, Zap, RotateCcw, Car, Users, Wrench, TrendingUp,
  TrendingDown, DollarSign, ChevronDown, ChevronUp, Star, TriangleAlert,
  Clock, BarChart2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function money(value) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function miles(value) {
  if (!Number.isFinite(value)) return "0 mi";
  return new Intl.NumberFormat("en-US").format(Math.round(value)) + " mi";
}

function getVehicleValue(results, variableId) {
  const found = results?.find((item) => item.VariableId === variableId);
  return found?.Value || "";
}

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

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35 },
};

const BUYER_TYPES = [
  {
    label: "Instant offer (CarMax, Carvana)",
    desc: "Fastest sale, lowest price. These buyers price to guarantee a profit after resale.",
    valueKey: "tradeIn",
    rangeKey: "tradeInRange",
    icon: TrendingDown,
    color: "text-amber-400",
    bg: "bg-amber-950/30 border-amber-800/40",
  },
  {
    label: "Dealership trade-in",
    desc: "Applied toward a new purchase. Dealers deduct reconditioning, transport, and profit margin.",
    valueKey: "tradeIn",
    rangeKey: "tradeInRange",
    icon: Car,
    color: "text-orange-400",
    bg: "bg-orange-950/30 border-orange-800/40",
  },
  {
    label: "Private sale (FB Marketplace)",
    desc: "Takes more effort but nets significantly more. You skip the dealer middleman.",
    valueKey: "privateParty",
    rangeKey: "privatePartyRange",
    icon: Users,
    color: "text-indigo-400",
    bg: "bg-indigo-950/30 border-indigo-800/40",
  },
  {
    label: "Dealer consignment / retail",
    desc: "Dealer sells it for you at retail price. You get more but wait longer and pay a fee.",
    valueKey: "retail",
    rangeKey: "retailRange",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-950/30 border-emerald-800/40",
  },
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
  const [result, setResult] = useState(null);
  const [phase, setPhase] = useState("vin");
  const [showRecon, setShowRecon] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showRecalls, setShowRecalls] = useState(false);

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
      setError(err.message || "Appraisal failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setVin(""); setDecoded(null); setError(""); setResult(null); setPhase("vin");
    setShowRecon(false); setShowListings(false);
  }

  const { appraisal, listings, recalls, safetyRating, marketStats } = result || {};

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
            <Badge className="rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">
              Full Appraisal
            </Badge>
            {phase !== "vin" && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-2 rounded-xl text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4" /> New appraisal
              </Button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* Phase 1: VIN */}
        {phase === "vin" && (
          <motion.main key="vin" {...fadeUp} className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-20">
            <div className="w-full max-w-2xl">
              <Badge className="mb-6 rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">
                Comprehensive dealer-grade appraisal
              </Badge>
              <h1 className="mb-3 text-5xl font-bold tracking-tight">
                What is your car{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  actually worth?
                </span>
              </h1>
              <p className="mb-10 text-lg text-muted-foreground">
                Get three valuations at once — trade-in, private party, and retail — so you know exactly what to expect from every type of buyer.
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

        {/* Phase 2: Details */}
        {phase === "details" && decoded && (
          <motion.main key="details" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Vehicle confirmed</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
              {decoded.Trim && <span className="ml-3 text-2xl font-medium text-muted-foreground">{decoded.Trim}</span>}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">Tell us about this specific car to get an accurate appraisal.</p>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Specs */}
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

              {/* Form */}
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
                    onClick={runAppraisal}
                    disabled={loading}
                    className="h-12 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
                  >
                    {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DollarSign className="mr-2 h-5 w-5" />}
                    Run Full Appraisal
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.main>
        )}

        {/* Phase 3: Results */}
        {phase === "results" && appraisal && (
          <motion.main key="results" {...fadeUp} className="mx-auto max-w-7xl px-6 py-16">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Appraisal complete</p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">
              {miles(Number(mileage))} · {condition} condition · {titleStatus} title · {owners} owner{owners !== "1" ? "s" : ""} · {serviceHistory} service history
              {accidents === "Yes" ? " · Accident reported" : ""}
            </p>

            {/* Three value cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Trade-in / Instant offer",
                  sublabel: "CarMax, Carvana, dealership",
                  value: appraisal.tradeIn,
                  range: appraisal.tradeInRange,
                  color: "from-amber-600 to-orange-600",
                  shadow: "shadow-amber-900/30",
                  badge: "Lowest",
                },
                {
                  label: "Private party",
                  sublabel: "Facebook Marketplace, Craigslist",
                  value: appraisal.privateParty,
                  range: appraisal.privatePartyRange,
                  color: "from-indigo-600 to-violet-600",
                  shadow: "shadow-indigo-900/30",
                  badge: "Most common",
                },
                {
                  label: "Retail / Consignment",
                  sublabel: "What dealers sell it for",
                  value: appraisal.retail,
                  range: appraisal.retailRange,
                  color: "from-emerald-600 to-teal-600",
                  shadow: "shadow-emerald-900/30",
                  badge: "Highest",
                },
              ].map(({ label, sublabel, value, range, color, shadow, badge }) => (
                <Card key={label} className={`overflow-hidden rounded-3xl border-0 shadow-2xl ${shadow}`}>
                  <div className={`bg-gradient-to-br ${color} p-6 text-white`}>
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

            {/* Who to sell to */}
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-bold">Who to sell to</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUYER_TYPES.map(({ label, desc, valueKey, rangeKey, icon: Icon, color, bg }) => (
                  <div key={label} className={`flex items-start gap-4 rounded-2xl border p-5 ${bg}`}>
                    <div className="mt-0.5 shrink-0">
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{label}</p>
                        <p className={`text-lg font-bold shrink-0 ${color}`}>{money(appraisal[valueKey])}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reconditioning breakdown */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <button
                  onClick={() => setShowRecon((v) => !v)}
                  className="flex w-full items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Reconditioning estimate</p>
                    <h2 className="mt-1 text-xl font-bold">
                      Est. dealer cost to resell this car:{" "}
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

            {/* Adjustments applied */}
            <Card className="mb-8 rounded-3xl border-border">
              <CardContent className="p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-indigo-500">How we adjusted</p>
                <h2 className="mb-5 text-xl font-bold">Factors applied to market median</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Condition", appraisal.adjustments.condition],
                    ["Title status", appraisal.adjustments.title],
                    ["Accident history", appraisal.adjustments.accident],
                    ["Service history", appraisal.adjustments.service],
                    ["Ownership count", appraisal.adjustments.owner],
                    ...(appraisal.adjustments.recalls !== 0 ? [["Open recalls", appraisal.adjustments.recalls]] : []),
                  ].map(([label, pct]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className={`text-sm font-bold ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pct >= 0 ? "+" : ""}{pct}%
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                    <p className="text-sm text-muted-foreground">Mileage vs comps</p>
                    <p className={`text-sm font-bold ${appraisal.adjustments.mileage >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {appraisal.adjustments.mileage >= 0 ? "+" : ""}{money(appraisal.adjustments.mileage)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Based on {appraisal.comparables} comparable listings · {appraisal.confidence}% confidence
                </p>
              </CardContent>
            </Card>

            {/* Safety & Recalls */}
            {(safetyRating || (recalls && recalls.length > 0)) && (
              <Card className="mb-8 rounded-3xl border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
                    {/* NCAP safety rating */}
                    {safetyRating && (
                      <div className="shrink-0">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">NHTSA Safety Rating</p>
                        <p className="mb-1 text-sm font-medium text-muted-foreground truncate max-w-[220px]">{safetyRating.description}</p>
                        <div className="flex items-center gap-1 mb-3">
                          {[1,2,3,4,5].map((n) => (
                            <Star
                              key={n}
                              className={`h-5 w-5 ${Number(safetyRating.overall) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                          <span className="ml-2 text-sm font-bold">{safetyRating.overall}/5</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-center">
                          {[
                            ["Front", safetyRating.frontCrash],
                            ["Side", safetyRating.sideCrash],
                            ["Rollover", safetyRating.rollover],
                          ].map(([label, val]) => (
                            <div key={label} className="rounded-xl bg-card p-2">
                              <p className="text-muted-foreground">{label}</p>
                              <p className="font-bold">{val ?? "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recalls */}
                    <div className="flex-1">
                      <button
                        onClick={() => setShowRecalls((v) => !v)}
                        className="flex w-full items-center justify-between text-left"
                      >
                        <div>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-500">Open Recalls</p>
                          {recalls && recalls.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <TriangleAlert className="h-4 w-4 text-amber-400" />
                              <h2 className="text-xl font-bold">
                                {recalls.length} open recall{recalls.length !== 1 ? "s" : ""}
                                <span className="ml-2 text-base font-medium text-amber-400">
                                  (−${Math.min(recalls.length * 300, 1000).toLocaleString()} applied)
                                </span>
                              </h2>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-400" />
                              <h2 className="text-xl font-bold text-emerald-400">No open recalls</h2>
                            </div>
                          )}
                        </div>
                        {recalls && recalls.length > 0 && (
                          showRecalls ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>

                      {showRecalls && recalls && recalls.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {recalls.map((r) => (
                            <div key={r.campaign} className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold text-amber-300">{r.component}</p>
                                <Badge className="rounded-full border-amber-800/50 bg-amber-950/50 text-amber-400 text-xs">{r.campaign}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{r.summary}</p>
                              {r.remedy && (
                                <p className="mt-1.5 text-xs text-emerald-400"><span className="font-medium">Fix:</span> {r.remedy}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Market stats */}
            {marketStats && (
              <Card className="mb-8 rounded-3xl border-border">
                <CardContent className="p-6">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-indigo-500">Market conditions</p>
                  <h2 className="mb-5 text-xl font-bold">How this car is moving right now</h2>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { icon: BarChart2, label: "Active listings", value: marketStats.totalListings?.toLocaleString() ?? "—", note: "within 200 mi" },
                      { icon: DollarSign, label: "Market median", value: marketStats.medianPrice ? `$${marketStats.medianPrice.toLocaleString()}` : "—", note: "asking price" },
                      { icon: Gauge, label: "Avg mileage", value: marketStats.avgMiles ? `${marketStats.avgMiles.toLocaleString()} mi` : "—", note: "on comparable cars" },
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

            {/* Comparable listings */}
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
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-indigo-800/60 sm:flex-row sm:items-center"
                    >
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
