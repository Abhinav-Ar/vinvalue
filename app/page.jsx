
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

  if (sorted.length % 2) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function conditionAdjustment(condition) {
  const map = {
    Excellent: 1.04,
    Good: 1,
    Fair: 0.93,
    Poor: 0.84,
  };

  return map[condition] ?? 1;
}

function titleAdjustment(titleStatus) {
  const map = {
    Clean: 1,
    Lien: 0.97,
    Rebuilt: 0.82,
    Salvage: 0.65,
  };

  return map[titleStatus] ?? 1;
}

function getVehicleValue(results, variableId) {
  const found = results?.find((item) => item.VariableId === variableId);
  return found?.Value || "";
}

function generateMockListings(vehicle, mileage, zip) {
  const year = Number(vehicle.ModelYear) || 2021;
  const make = vehicle.Make || "Toyota";
  const model = vehicle.Model || "Camry";
  const trim = vehicle.Trim || "SE";

  const age = Math.max(0, new Date().getFullYear() - year);
  const base = Math.max(6500, 36500 - age * 2150);
  const userMiles = Number(mileage) || 65000;

  const cities = [
    "San Jose, CA",
    "Fremont, CA",
    "Oakland, CA",
    "Sacramento, CA",
    "Los Angeles, CA",
    "Irvine, CA",
    "San Diego, CA",
    "Stockton, CA",
  ];

  const sources = [
    "Dealer Listing",
    "Private Seller",
    "Marketplace",
    "Certified Dealer",
    "Local Inventory",
  ];

  return Array.from({ length: 12 }).map((_, index) => {
    const mileageShift = (index - 5) * 7800 + (index % 3) * 1800;
    const listingMileage = Math.max(8000, userMiles + mileageShift);
    const mileagePenalty = (listingMileage - 45000) * 0.055;
    const trimBoost = trim && trim.length > 1 ? 750 : 0;

    const randomness = [
      1400, -600, 900, -1200, 300, 1600, -850, 500, -300, 1100, -1500, 700,
    ][index];

    const price = Math.max(
      4000,
      base + trimBoost - mileagePenalty + randomness
    );

    return {
      id: index + 1,
      title: `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`,
      price: Math.round(price / 100) * 100,
      mileage: Math.round(listingMileage / 100) * 100,
      location: cities[index % cities.length],
      distance: 8 + index * 17,
      source: sources[index % sources.length],
      url: "#",
      matchScore: Math.max(
        68,
        98 - Math.abs(listingMileage - userMiles) / 2500 - index
      ),
      zip,
    };
  });
}

function FieldLabel({ icon: Icon, label, children }) {
  return (
    <label className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {children}
    </label>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          {value}
        </p>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export default function VinValueMVP() {
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

  function findMarketValue() {
    if (!decoded) return;
    setListings(generateMockListings(decoded, Number(mileage), zip));
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

  const chartData = useMemo(() => {
    return listings.map((item) => ({
      mileage: item.mileage,
      price: item.price,
      name: item.title,
    }));
  }, [listings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">VinValue</p>
              <p className="text-xs text-slate-500">VIN based car valuation</p>
            </div>
          </div>

          <Badge className="rounded-full px-3 py-1" variant="secondary">
            MVP Prototype
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Badge className="mb-4 rounded-full px-3 py-1" variant="outline">
              Market comps plus VIN decode
            </Badge>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Enter a VIN. Compare similar listings. Estimate a fair car value.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Decode a vehicle, add mileage and condition, then compare it
              against similar market listings. KBB can be added later as a
              licensed data source.
            </p>

            <Card className="mt-7 rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={vin}
                    onChange={(event) =>
                      setVin(event.target.value.toUpperCase())
                    }
                    maxLength={17}
                    placeholder="Enter 17 character VIN"
                    className="h-12 rounded-2xl text-base tracking-wide"
                  />

                  <Button
                    onClick={decodeVin}
                    disabled={loading}
                    className="h-12 rounded-2xl px-6"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Decode VIN
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{cleanVin.length}/17 characters</span>
                  <span>•</span>
                  <span>No account needed for this prototype</span>
                </div>

                {decodeError && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    {decodeError}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Decoded vehicle
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {decoded
                        ? `${decoded.ModelYear} ${decoded.Make} ${decoded.Model}`
                        : "Waiting for VIN"}
                    </h2>
                  </div>

                  <ShieldCheck className="h-8 w-8 text-slate-400" />
                </div>

                {decoded ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Trim", decoded.Trim || "Not found"],
                      ["Body", decoded.BodyClass || "Not found"],
                      [
                        "Engine",
                        decoded.EngineCylinders
                          ? `${decoded.EngineCylinders} cylinders`
                          : "Not found",
                      ],
                      ["Drive", decoded.DriveType || "Not found"],
                      ["Fuel", decoded.FuelTypePrimary || "Not found"],
                      ["VIN", decoded.VIN],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                    Try a valid VIN to unlock vehicle details, condition inputs,
                    estimated market value, and comparable listings.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </section>

        {decoded && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-medium text-slate-500">
                    Vehicle details
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Tell us about this specific car
                  </h2>
                </div>

                <div className="grid gap-4">
                  <FieldLabel icon={Gauge} label="Mileage">
                    <Input
                      value={mileage}
                      onChange={(event) => setMileage(event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                  </FieldLabel>

                  <FieldLabel icon={MapPin} label="ZIP code">
                    <Input
                      value={zip}
                      onChange={(event) => setZip(event.target.value)}
                      className="h-11 rounded-2xl"
                    />
                  </FieldLabel>

                  <FieldLabel icon={ShieldCheck} label="Condition">
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
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
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <FieldLabel
                    icon={AlertTriangle}
                    label="Reported accident history"
                  >
                    <Select value={accidents} onValueChange={setAccidents}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldLabel>

                  <Button
                    onClick={findMarketValue}
                    className="mt-2 h-12 rounded-2xl"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Find Market Value
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {valuation ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      label="Estimated value"
                      value={`${money(valuation.estimateLow)} to ${money(
                        valuation.estimateHigh
                      )}`}
                      detail="Adjusted for mileage, condition, title, and accidents"
                    />
                    <StatCard
                      label="Median comp"
                      value={money(valuation.med)}
                      detail={`${listings.length} comparable listings`}
                    />
                    <StatCard
                      label="Average comp"
                      value={money(valuation.avg)}
                      detail={`Market range ${money(valuation.low)} to ${money(
                        valuation.high
                      )}`}
                    />
                    <StatCard
                      label="Confidence"
                      value={`${Math.round(valuation.confidence)}%`}
                      detail="Based on comp count and match quality"
                    />
                  </div>

                  <Card className="rounded-3xl border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                      <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                        <div>
                          <p className="text-sm font-medium text-slate-500">
                            Price vs mileage
                          </p>
                          <h2 className="text-2xl font-semibold tracking-tight">
                            Comparable listing spread
                          </h2>
                        </div>

                        <Badge variant="secondary" className="w-fit rounded-full">
                          Mock listing data
                        </Badge>
                      </div>

                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart
                            margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="mileage"
                              name="Mileage"
                              tickFormatter={(value) =>
                                `${Math.round(value / 1000)}k`
                              }
                            />
                            <YAxis
                              dataKey="price"
                              name="Price"
                              tickFormatter={(value) =>
                                `$${Math.round(value / 1000)}k`
                              }
                            />
                            <Tooltip
                              formatter={(value, name) =>
                                name === "price" ? money(value) : miles(value)
                              }
                            />
                            <Scatter data={chartData} dataKey="price" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="rounded-3xl border-dashed border-slate-300 bg-white/70 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <TrendingUp className="mx-auto h-10 w-10 text-slate-400" />
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                      Ready for valuation
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                      Enter mileage, ZIP, condition, title status, and accident
                      history, then generate a market value estimate.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {valuation && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-5">
                  <p className="text-sm font-medium text-slate-500">
                    Comparable cars
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Similar listings on the market
                  </h2>
                </div>

                <div className="grid gap-3">
                  {listings.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">
                            {item.title}
                          </h3>
                          <Badge variant="outline" className="rounded-full">
                            {Math.round(item.matchScore)}% match
                          </Badge>
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {miles(item.mileage)} • {item.location} •{" "}
                          {item.distance} mi away • {item.source}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="text-xl font-bold tracking-tight">
                          {money(item.price)}
                        </p>
                        <Button variant="outline" size="sm" className="rounded-xl">
                          View <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">
                    KBB integration
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                    Licensed API placeholder
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    This MVP leaves KBB as a protected integration. Add it later
                    through a backend route after you get licensed API access. Do
                    not scrape KBB pages.
                  </p>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      KBB private party value
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-400">
                      Pending
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">
                    Next build steps
                  </p>

                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <p>1. Replace mock comps with a listings API.</p>
                    <p>2. Store searches in Supabase.</p>
                    <p>3. Add user accounts and saved reports.</p>
                    <p>4. Add PDF export for valuation reports.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

