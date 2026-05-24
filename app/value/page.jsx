"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Car,
  Search,
  Gauge,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ExternalLink,
  Zap,
  ArrowLeft,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor"];
const TITLE_OPTIONS = ["Clean", "Lien", "Salvage", "Rebuilt"];

function money(value) {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function miles(value) {
  if (!Number.isFinite(value)) return "0 mi";
  return new Intl.NumberFormat("en-US").format(Math.round(value)) + " mi";
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function conditionAdjustment(condition) {
  const map = { Excellent: 1.04, Good: 1, Fair: 0.93, Poor: 0.84 };
  return map[condition] ?? 1;
}

function titleAdjustment(titleStatus) {
  const map = { Clean: 1, Lien: 0.97, Rebuilt: 0.82, Salvage: 0.65 };
  return map[titleStatus] ?? 1;
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

export default function ValuePage() {
  const [vin, setVin] = useState("");
  const [decoded, setDecoded] = useState(null);
  const [decodeError, setDecodeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mileage, setMileage] = useState("65000");
  const [zip, setZip] = useState("94538");
  const [condition, setCondition] = useState("Good");
  const [titleStatus, setTitleStatus] = useState("Clean");
  const [accidents, setAccidents] = useState("No");
  const [listings, setListings] = useState([]);
  const [phase, setPhase] = useState("vin");

  const cleanVin = vin.trim().toUpperCase();

  async function decodeVin() {
    setDecodeError("");
    setListings([]);
    setDecoded(null);

    if (cleanVin.length !== 17) {
      setDecodeError("VIN must be exactly 17 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${cleanVin}?format=json`
      );
      const data = await response.json();
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

      if (!vehicle.Make && !vehicle.Model && !vehicle.ModelYear) {
        throw new Error("Could not decode this VIN. Try another.");
      }

      setDecoded(vehicle);
      setPhase("details");
    } catch (error) {
      setDecodeError(error.message || "VIN decode failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function findMarketValue() {
    if (!decoded) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: decoded.ModelYear,
        make: decoded.Make,
        model: decoded.Model,
        zip,
        mileage,
      });
      const res = await fetch(`/api/listings?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setListings(data.listings);
      setPhase("results");
    } catch (err) {
      setDecodeError(err.message || "Failed to fetch listings.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setVin("");
    setDecoded(null);
    setDecodeError("");
    setListings([]);
    setPhase("vin");
  }

  const valuation = useMemo(() => {
    if (!listings.length) return null;

    const prices = listings.map((item) => item.price);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const med = median(prices);
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    const userMileage = Number(mileage) || 0;
    const avgMileage =
      listings.reduce((sum, item) => sum + item.mileage, 0) / listings.length;

    const mileageAdjustment = (avgMileage - userMileage) * 0.045;
    const accidentFactor = accidents === "Yes" ? 0.9 : 1;

    const adjustedMedian =
      med *
        conditionAdjustment(condition) *
        titleAdjustment(titleStatus) *
        accidentFactor +
      mileageAdjustment;

    const confidence = Math.min(
      96,
      Math.max(
        52,
        50 +
          listings.length * 3 +
          listings.filter((item) => item.matchScore > 82).length * 2
      )
    );

    return {
      avg,
      med,
      low,
      high,
      adjustedMedian,
      estimateLow: adjustedMedian * 0.94,
      estimateHigh: adjustedMedian * 1.06,
      confidence,
    };
  }, [listings, mileage, condition, titleStatus, accidents]);

  const chartData = useMemo(
    () =>
      listings.map((item) => ({
        mileage: item.mileage,
        price: item.price,
        name: item.title,
      })),
    [listings]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight group-hover:text-indigo-400 transition-colors">AutoIQ</span>
          </Link>

          <div className="flex items-center gap-3">
            {phase !== "vin" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="rounded-xl text-muted-foreground hover:text-foreground gap-2"
              >
                <RotateCcw className="h-4 w-4" /> New search
              </Button>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {["vin", "details", "results"].map((p, i) => (
                <React.Fragment key={p}>
                  <span className={phase === p ? "font-semibold text-indigo-400" : ""}>
                    {i + 1}
                  </span>
                  {i < 2 && <span className="text-border">—</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* Phase 1: VIN Entry */}
        {phase === "vin" && (
          <motion.main
            key="vin"
            {...fadeUp}
            className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center px-6 py-20"
          >
            <div className="w-full max-w-2xl">
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-indigo-500">
                Step 1 of 3
              </p>
              <h1 className="mb-3 text-center text-5xl font-bold tracking-tight">
                Enter your VIN
              </h1>
              <p className="mb-10 text-center text-lg text-muted-foreground">
                The 17-character Vehicle Identification Number is on your
                dashboard, door jamb, or registration.
              </p>

              <Card className="rounded-3xl border-border shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={vin}
                      onChange={(e) => setVin(e.target.value.toUpperCase())}
                      maxLength={17}
                      placeholder="e.g. 1HGCM82633A004352"
                      className="h-14 rounded-2xl text-lg tracking-widest"
                      onKeyDown={(e) => e.key === "Enter" && decodeVin()}
                    />
                    <Button
                      onClick={decodeVin}
                      disabled={loading}
                      className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-8 text-base text-white shadow-md shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-5 w-5" />
                      )}
                      Decode
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className={
                        cleanVin.length === 17
                          ? "font-semibold text-emerald-400"
                          : ""
                      }
                    >
                      {cleanVin.length}/17 characters
                    </span>
                    <span>·</span>
                    <span>Free · No account needed</span>
                  </div>

                  {decodeError && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {decodeError}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.main>
        )}

        {/* Phase 2: Details */}
        {phase === "details" && decoded && (
          <motion.main
            key="details"
            {...fadeUp}
            className="mx-auto max-w-7xl px-6 py-16"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Step 2 of 3
            </p>
            <h1 className="mb-2 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
              {decoded.Trim && (
                <span className="ml-3 text-2xl text-muted-foreground font-medium">
                  {decoded.Trim}
                </span>
              )}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">
              VIN decoded. Now tell us about this specific car.
            </p>

            <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
              {/* Vehicle specs */}
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vehicle specs
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Body", decoded.BodyClass || "—"],
                    ["Engine", decoded.EngineCylinders ? `${decoded.EngineCylinders} cylinders` : "—"],
                    ["Drive", decoded.DriveType || "—"],
                    ["Fuel", decoded.FuelTypePrimary || "—"],
                    ["Trim", decoded.Trim || "—"],
                    ["VIN", decoded.VIN],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details form */}
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your car's details
                </p>
                <Card className="rounded-3xl border-border">
                  <CardContent className="p-6 grid gap-5">
                    <FieldLabel icon={Gauge} label="Current mileage">
                      <Input
                        value={mileage}
                        onChange={(e) => setMileage(e.target.value)}
                        className="h-11 rounded-2xl"
                      />
                    </FieldLabel>

                    <FieldLabel icon={MapPin} label="ZIP code">
                      <Input
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        className="h-11 rounded-2xl"
                      />
                    </FieldLabel>

                    <div className="grid gap-5 sm:grid-cols-3">
                      <FieldLabel icon={ShieldCheck} label="Condition">
                        <Select value={condition} onValueChange={setCondition}>
                          <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDITIONS.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldLabel>

                      <FieldLabel icon={Car} label="Title status">
                        <Select value={titleStatus} onValueChange={setTitleStatus}>
                          <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TITLE_OPTIONS.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FieldLabel>

                      <FieldLabel icon={AlertTriangle} label="Accidents">
                        <Select value={accidents} onValueChange={setAccidents}>
                          <SelectTrigger className="h-11 rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="No">None</SelectItem>
                            <SelectItem value="Yes">Reported</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldLabel>
                    </div>

                    {decodeError && (
                      <div className="flex items-center gap-2 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {decodeError}
                      </div>
                    )}

                    <Button
                      onClick={findMarketValue}
                      disabled={loading}
                      className="h-13 mt-2 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-base text-white shadow-md shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <TrendingUp className="mr-2 h-5 w-5" />
                      )}
                      Find Market Value
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.main>
        )}

        {/* Phase 3: Results */}
        {phase === "results" && valuation && (
          <motion.main
            key="results"
            {...fadeUp}
            className="mx-auto max-w-7xl px-6 py-16"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
              Step 3 of 3 · Results
            </p>
            <h1 className="mb-1 text-4xl font-bold tracking-tight">
              {decoded.ModelYear} {decoded.Make} {decoded.Model}
            </h1>
            <p className="mb-12 text-lg text-muted-foreground">
              {miles(Number(mileage))} · {condition} condition · {titleStatus} title
              {accidents === "Yes" ? " · Accident reported" : ""}
            </p>

            {/* Valuation hero */}
            <Card className="mb-8 overflow-hidden rounded-3xl border-0 shadow-2xl shadow-indigo-900/30">
              <div className="bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-8 py-10 text-white">
                <p className="text-base font-medium text-indigo-200">
                  Estimated Fair Market Value
                </p>
                <p className="mt-2 text-6xl font-bold tracking-tight">
                  {money(valuation.estimateLow)} –{" "}
                  {money(valuation.estimateHigh)}
                </p>
                <p className="mt-3 text-indigo-200">
                  Adjusted for mileage, condition, title status &amp; accident
                  history
                </p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-border bg-card">
                {[
                  ["Median comp", money(valuation.med)],
                  ["Average comp", money(valuation.avg)],
                  ["Confidence", `${Math.round(valuation.confidence)}%`],
                ].map(([label, value], i) => (
                  <div key={label} className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className={`mt-1 text-2xl font-bold ${i === 2 ? "text-indigo-400" : ""}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chart + listings */}
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
              {/* Chart */}
              <Card className="rounded-3xl border-border">
                <CardContent className="p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                        Market spread
                      </p>
                      <h2 className="mt-1 text-xl font-bold">Price vs Mileage</h2>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950/80">
                      <BarChart3 className="h-4 w-4 text-indigo-400" />
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                        <XAxis
                          dataKey="mileage"
                          name="Mileage"
                          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                          tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="price"
                          name="Price"
                          tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                          tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value, name) =>
                            name === "price" ? money(value) : miles(value)
                          }
                          contentStyle={{
                            borderRadius: "12px",
                            background: "oklch(0.205 0 0)",
                            border: "1px solid oklch(1 0 0 / 10%)",
                            color: "white",
                          }}
                        />
                        <Scatter data={chartData} dataKey="price" fill="#818cf8" opacity={0.9} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Range breakdown */}
              <Card className="rounded-3xl border-border">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                    Price range
                  </p>
                  <h2 className="mt-1 mb-6 text-xl font-bold">Market low to high</h2>
                  <div className="space-y-4">
                    {[
                      { label: "Market low", value: valuation.low, color: "text-emerald-400" },
                      { label: "Your estimated value", value: valuation.adjustedMedian, color: "text-indigo-400", highlight: true },
                      { label: "Market high", value: valuation.high, color: "text-rose-400" },
                    ].map(({ label, value, color, highlight }) => (
                      <div
                        key={label}
                        className={`flex items-center justify-between rounded-2xl p-4 ${highlight ? "border border-indigo-800/50 bg-indigo-950/40" : "bg-card"}`}
                      >
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>{money(value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">Based on {listings.length} comparable listings within 100 miles</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Listings */}
            <div className="mt-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">
                Live comps
              </p>
              <h2 className="mb-6 text-2xl font-bold">Similar listings near you</h2>
              <div className="grid gap-3">
                {listings.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-indigo-800/60 hover:bg-indigo-950/20 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.title}</h3>
                        <Badge className="rounded-full border-indigo-800/50 bg-indigo-950/60 text-xs text-indigo-400">
                          {Math.round(item.matchScore)}% match
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {miles(item.mileage)}
                        {item.location && ` · ${item.location}`}
                        {item.distance && ` · ${item.distance} mi away`}
                        {item.source && ` · ${item.source}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:shrink-0">
                      <p className="text-2xl font-bold text-indigo-400">{money(item.price)}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        asChild
                      >
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          View <ExternalLink className="ml-1.5 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
