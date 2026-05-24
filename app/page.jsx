
"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Icon className="h-4 w-4 text-indigo-500" />
        {label}
      </div>
      {children}
    </label>
  );
}

export default function AutoIQ() {
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
        throw new Error("Could not decode this VIN. Try another VIN.");
      }

      setDecoded(vehicle);
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
    } catch (err) {
      setDecodeError(err.message || "Failed to fetch listings.");
    } finally {
      setLoading(false);
    }
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
    () => listings.map((item) => ({ mileage: item.mileage, price: item.price, name: item.title })),
    [listings]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-indigo-100/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">AutoIQ</p>
              <p className="text-xs font-medium text-indigo-500">Smart Car Valuations</p>
            </div>
          </div>
          <Badge className="rounded-full border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-50">
            Beta
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero */}
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge className="mb-5 rounded-full border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-600">
              VIN decode + live market comps
            </Badge>

            <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">
              Know exactly what{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                your car
              </span>{" "}
              is worth.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-500">
              Enter a VIN to decode your vehicle, then compare it against live
              market listings to get an accurate, adjusted valuation in seconds.
            </p>

            <Card className="mt-8 rounded-3xl border-indigo-100 shadow-xl shadow-indigo-100/50">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    maxLength={17}
                    placeholder="Enter 17-character VIN"
                    className="h-12 rounded-2xl border-slate-200 text-base tracking-widest focus-visible:ring-indigo-400"
                  />
                  <Button
                    onClick={decodeVin}
                    disabled={loading}
                    className="h-12 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-7 text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Decode VIN
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className={cleanVin.length === 17 ? "font-semibold text-emerald-500" : ""}>
                    {cleanVin.length}/17 characters
                  </span>
                  <span>•</span>
                  <span>No account needed</span>
                </div>

                {decodeError && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {decodeError}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card className="overflow-hidden rounded-3xl border-0 shadow-2xl shadow-indigo-100/60">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <CardContent className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                      Decoded Vehicle
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      {decoded
                        ? `${decoded.ModelYear} ${decoded.Make} ${decoded.Model}`
                        : "Waiting for VIN"}
                    </h2>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50">
                    <Car className="h-5 w-5 text-indigo-500" />
                  </div>
                </div>

                {decoded ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Trim", decoded.Trim || "—"],
                      ["Body", decoded.BodyClass || "—"],
                      ["Engine", decoded.EngineCylinders ? `${decoded.EngineCylinders} cyl` : "—"],
                      ["Drive", decoded.DriveType || "—"],
                      ["Fuel", decoded.FuelTypePrimary || "—"],
                      ["VIN", decoded.VIN],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-400">{label}</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-indigo-50/60 p-5 text-sm leading-6 text-indigo-600">
                    Enter a valid VIN to unlock vehicle details, market comps, and a fair value estimate.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {/* Vehicle Details + Valuation */}
        {decoded && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <Card className="rounded-3xl border-slate-100 shadow-lg">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                  Vehicle Details
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  About this car
                </h2>

                <div className="mt-5 grid gap-4">
                  <FieldLabel icon={Gauge} label="Mileage">
                    <Input
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      className="h-11 rounded-2xl border-slate-200 focus-visible:ring-indigo-400"
                    />
                  </FieldLabel>

                  <FieldLabel icon={MapPin} label="ZIP Code">
                    <Input
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="h-11 rounded-2xl border-slate-200 focus-visible:ring-indigo-400"
                    />
                  </FieldLabel>

                  <FieldLabel icon={ShieldCheck} label="Condition">
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={Car} label="Title Status">
                    <Select value={titleStatus} onValueChange={setTitleStatus}>
                      <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TITLE_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel icon={AlertTriangle} label="Accident History">
                    <Select value={accidents} onValueChange={setAccidents}>
                      <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No accidents reported</SelectItem>
                        <SelectItem value="Yes">Accident reported</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <Button
                    onClick={findMarketValue}
                    disabled={loading}
                    className="mt-2 h-12 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TrendingUp className="mr-2 h-4 w-4" />
                    )}
                    Find Market Value
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              {valuation ? (
                <>
                  {/* Big value card */}
                  <Card className="overflow-hidden rounded-3xl border-0 shadow-xl shadow-indigo-100/60">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
                      <p className="text-sm font-medium text-indigo-200">Estimated Fair Value</p>
                      <p className="mt-1 text-4xl font-bold tracking-tight">
                        {money(valuation.estimateLow)} – {money(valuation.estimateHigh)}
                      </p>
                      <p className="mt-2 text-sm text-indigo-200">
                        Adjusted for mileage, condition, title &amp; accident history
                      </p>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white">
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">Median</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{money(valuation.med)}</p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">Average</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{money(valuation.avg)}</p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-xs text-slate-500">Confidence</p>
                        <p className="mt-1 text-lg font-bold text-indigo-600">{Math.round(valuation.confidence)}%</p>
                      </div>
                    </div>
                  </Card>

                  {/* Chart */}
                  <Card className="rounded-3xl border-slate-100 shadow-lg">
                    <CardContent className="p-6">
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Market Spread</p>
                          <h2 className="mt-1 text-xl font-bold text-slate-900">Price vs Mileage</h2>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-50">
                          <BarChart3 className="h-4 w-4 text-indigo-500" />
                        </div>
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="mileage"
                              name="Mileage"
                              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                              tick={{ fill: "#94a3b8", fontSize: 12 }}
                              axisLine={{ stroke: "#e2e8f0" }}
                              tickLine={false}
                            />
                            <YAxis
                              dataKey="price"
                              name="Price"
                              tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                              tick={{ fill: "#94a3b8", fontSize: 12 }}
                              axisLine={{ stroke: "#e2e8f0" }}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value, name) => name === "price" ? money(value) : miles(value)}
                              contentStyle={{
                                borderRadius: "12px",
                                border: "1px solid #e2e8f0",
                                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.08)",
                              }}
                            />
                            <Scatter data={chartData} dataKey="price" fill="#6366f1" opacity={0.85} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="flex min-h-64 items-center rounded-3xl border-dashed border-indigo-200 bg-indigo-50/30 shadow-sm">
                  <CardContent className="w-full p-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">
                      <TrendingUp className="h-7 w-7 text-indigo-500" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-900">Ready to valuate</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                      Fill in the details and click Find Market Value to get your estimate.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.section>
        )}

        {/* Listings */}
        {valuation && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.75fr]"
          >
            <Card className="rounded-3xl border-slate-100 shadow-lg">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                  Live Comps
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Similar listings near you
                </h2>

                <div className="mt-5 grid gap-3">
                  {listings.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{item.title}</h3>
                          <Badge className="rounded-full border-indigo-200 bg-indigo-100 text-xs text-indigo-700 hover:bg-indigo-100">
                            {Math.round(item.matchScore)}% match
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {miles(item.mileage)}
                          {item.location && ` • ${item.location}`}
                          {item.distance && ` • ${item.distance} mi away`}
                          {item.source && ` • ${item.source}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 sm:shrink-0">
                        <p className="text-xl font-bold text-indigo-600">{money(item.price)}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
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
              </CardContent>
            </Card>

            <div className="space-y-5">
              {/* KBB placeholder */}
              <Card className="overflow-hidden rounded-3xl border-slate-100 shadow-lg">
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                    Coming Soon
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">KBB Integration</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Official Kelley Blue Book values added via licensed API. Requires a Cox Automotive partnership.
                  </p>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">KBB Private Party Value</p>
                    <p className="mt-1 text-2xl font-bold text-slate-300">Pending</p>
                  </div>
                </CardContent>
              </Card>

              {/* Roadmap */}
              <Card className="rounded-3xl border-slate-100 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                    Roadmap
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      "KBB licensed API integration",
                      "Save searches with Supabase",
                      "User accounts & saved reports",
                      "PDF export for valuations",
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                          {i + 1}
                        </div>
                        {step}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}
