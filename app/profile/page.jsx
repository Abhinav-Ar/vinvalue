"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, Copy, Check, Printer, AlertTriangle, ShieldCheck,
  Star, Clock, BarChart2, ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decodeProfile } from "@/lib/profileEncoding";

function money(v) {
  if (!Number.isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

// Maps our condition answers to exactly what each buyer's form will ask
function buildBuyerGuide(condition) {
  const {
    mileage, titleStatus, accidents, warningLights,
    mechanicalIssues, bodyDamage, featuresWorking,
    keysCount, owners, serviceHistory,
  } = condition;

  const noAccidents = accidents === "No";
  const hasLien = titleStatus === "Lien";
  const keyNum = keysCount === "Both sets" ? "2" : keysCount === "One set" ? "1" : "0";

  return {
    carvana: [
      { q: "Odometer reading", a: `${Number(mileage).toLocaleString()} miles` },
      { q: "Any accidents on record?", a: noAccidents ? "No accidents" : "Yes — reported" },
      { q: "Warning lights currently on?", a: warningLights === "None" ? "No" : `Yes — ${warningLights.toLowerCase()}` },
      { q: "Visible body / paint damage?", a: bodyDamage === "None" ? "No damage" : `Yes — ${bodyDamage.toLowerCase()}` },
      { q: "Do all features work (AC, windows, etc.)?", a: featuresWorking === "Yes" ? "Yes, all working" : `Issues — ${featuresWorking.toLowerCase()}` },
      { q: "Major mechanical problems?", a: mechanicalIssues === "None" ? "No" : `Yes — ${mechanicalIssues.toLowerCase()}` },
      { q: "Is there a lien on the car?", a: hasLien ? "Yes — has a lien" : "No lien" },
      { q: "How many key fobs / remotes?", a: keyNum },
    ],
    carmax: [
      { q: "Odometer reading", a: `${Number(mileage).toLocaleString()} miles` },
      { q: "Has the car been in any accidents?", a: noAccidents ? "No" : "Yes" },
      { q: "Any known mechanical problems?", a: mechanicalIssues === "None" ? "No" : `Yes — ${mechanicalIssues.toLowerCase()}` },
      { q: "Any warning or check engine lights?", a: warningLights === "None" ? "No" : `Yes — ${warningLights.toLowerCase()}` },
      { q: "Exterior condition", a: bodyDamage === "None" ? "Clean — no damage" : `${bodyDamage} damage present` },
      { q: "Do all electronics work?", a: featuresWorking === "Yes" ? "Yes" : `No — ${featuresWorking.toLowerCase()}` },
      { q: "Do you own it outright (no loan)?", a: hasLien ? "No — has a lien" : "Yes" },
      { q: "Number of keys", a: keyNum },
    ],
  };
}

function conditionLabel(condition) {
  const map = {
    "None": "✓ None",
    "Check engine": "⚠ Check engine light",
    "Multiple": "⚠ Multiple lights",
    "Minor": "Minor",
    "Moderate": "Moderate",
    "Major": "⚠ Major",
    "Yes": "✓ Yes",
    "Minor issues": "Minor issues",
    "Major issues": "⚠ Major issues",
    "Both sets": "✓ Both sets",
    "One set": "One set only",
    "No keys": "⚠ No keys",
    "No": "✓ None reported",
    "Clean": "✓ Clean",
    "Lien": "Has lien",
    "Rebuilt": "Rebuilt",
    "Salvage": "⚠ Salvage",
    "Full dealer": "Full dealer",
    "Full independent": "Full independent",
    "Partial": "Partial",
  };
  return map[condition] ?? condition;
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2 rounded-xl print:hidden">
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d");
  const profile = encoded ? decodeProfile(encoded) : null;

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg text-muted-foreground">This profile link is invalid or expired.</p>
        <Link href="/appraise">
          <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
            Run a new appraisal
          </Button>
        </Link>
      </div>
    );
  }

  const { vehicle, condition, appraisal, recallCount, safetyOverall, avgDaysOnMarket, generatedAt, vin } = profile;
  const guide = buildBuyerGuide(condition);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const overallConditionBadge = () => {
    const issues = [
      condition.warningLights !== "None",
      condition.mechanicalIssues !== "None",
      condition.bodyDamage !== "None",
      condition.featuresWorking !== "Yes",
      condition.accidents === "Yes",
    ].filter(Boolean).length;
    if (issues === 0) return { label: "Clean", color: "border-emerald-800/50 bg-emerald-950/50 text-emerald-400" };
    if (issues <= 1) return { label: "Minor issues", color: "border-amber-800/50 bg-amber-950/50 text-amber-400" };
    return { label: "Multiple issues", color: "border-red-800/50 bg-red-950/50 text-red-400" };
  };

  const badge = overallConditionBadge();

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl print:static print:bg-transparent print:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">AutoIQ</span>
          </Link>
          <div className="flex items-center gap-2 print:hidden">
            <CopyButton url={currentUrl} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2 rounded-xl"
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">

        {/* ── Vehicle hero ── */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">
                Seller's Report
              </Badge>
              <Badge className={`rounded-full border ${badge.color}`}>
                {badge.label}
              </Badge>
              {recallCount > 0 && (
                <Badge className="rounded-full border-amber-800/50 bg-amber-950/50 text-amber-400">
                  {recallCount} open recall{recallCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim && <span className="ml-3 text-2xl font-medium text-muted-foreground">{vehicle.trim}</span>}
            </h1>
            <p className="mt-2 font-mono text-sm text-muted-foreground">{vin}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {Number(condition.mileage).toLocaleString()} miles · {condition.condition} condition · {condition.titleStatus} title
              {condition.accidents === "Yes" ? " · Accident reported" : ""}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-border bg-card p-4 text-right text-sm">
            <p className="text-xs text-muted-foreground">Generated</p>
            <p className="font-semibold">{generatedAt}</p>
            {appraisal.confidence && (
              <>
                <p className="mt-2 text-xs text-muted-foreground">Based on</p>
                <p className="font-semibold">{appraisal.comparables} comps · {appraisal.confidence}% confidence</p>
              </>
            )}
            {avgDaysOnMarket && (
              <>
                <p className="mt-2 text-xs text-muted-foreground">Avg days to sell</p>
                <p className="font-semibold">{avgDaysOnMarket} days</p>
              </>
            )}
          </div>
        </div>

        {/* ── Value summary ── */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Trade-in / Instant offer", sublabel: "Carvana, CarMax, CarGurus", value: appraisal.tradeIn, range: appraisal.tradeInRange, gradient: "from-amber-600 to-orange-600", shadow: "shadow-amber-900/30", badge: "Lowest" },
            { label: "Private party", sublabel: "Facebook Marketplace, Craigslist", value: appraisal.privateParty, range: appraisal.privatePartyRange, gradient: "from-indigo-600 to-violet-600", shadow: "shadow-indigo-900/30", badge: "Most common" },
            { label: "Dealer retail", sublabel: "What dealers will sell it for", value: appraisal.retail, range: appraisal.retailRange, gradient: "from-emerald-600 to-teal-600", shadow: "shadow-emerald-900/30", badge: "Highest" },
          ].map(({ label, sublabel, value, range, gradient, shadow, badge: b }) => (
            <Card key={label} className={`overflow-hidden rounded-3xl border-0 shadow-2xl ${shadow}`}>
              <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
                <Badge className="mb-3 rounded-full border-white/20 bg-white/15 text-white text-xs">{b}</Badge>
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

        {/* ── Buyer quick-reference guides ── */}
        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          {[
            {
              buyer: "Carvana",
              url: "https://www.carvana.com/sell-my-car",
              gradient: "from-blue-600 to-cyan-600",
              items: guide.carvana,
            },
            {
              buyer: "CarMax",
              url: "https://www.carmax.com/sell-my-car",
              gradient: "from-orange-600 to-amber-600",
              items: guide.carmax,
            },
          ].map(({ buyer, url, gradient, items }) => (
            <Card key={buyer} className="overflow-hidden rounded-3xl border-border">
              <div className={`bg-gradient-to-br ${gradient} px-6 py-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Quick reference</p>
                    <h2 className="text-xl font-bold">{buyer} will ask you…</h2>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl border-white/30 bg-white/15 text-white hover:bg-white/25 print:hidden"
                    variant="outline"
                    asChild
                  >
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      Go <ExternalLink className="ml-1.5 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
              <CardContent className="p-0">
                {items.map(({ q, a }, i) => (
                  <div
                    key={q}
                    className={`flex items-start justify-between gap-4 px-5 py-3.5 ${i !== items.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <p className="text-sm text-muted-foreground">{q}</p>
                    <p className="shrink-0 text-sm font-semibold text-right max-w-[45%]">{a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Full condition summary ── */}
        <Card className="mb-10 rounded-3xl border-border">
          <CardContent className="p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-indigo-500">Full condition summary</p>
            <h2 className="mb-5 text-xl font-bold">What was reported about this car</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Mileage", `${Number(condition.mileage).toLocaleString()} miles`],
                ["Condition (overall)", condition.condition],
                ["Title status", conditionLabel(condition.titleStatus)],
                ["Accident history", condition.accidents === "No" ? "✓ None reported" : "⚠ Reported"],
                ["Service history", condition.serviceHistory],
                ["Number of owners", condition.owners === "1" ? "1 owner" : condition.owners === "2" ? "2 owners" : "3+ owners"],
                ["Warning lights", conditionLabel(condition.warningLights)],
                ["Mechanical issues", conditionLabel(condition.mechanicalIssues)],
                ["Body / exterior damage", conditionLabel(condition.bodyDamage)],
                ["Features & electronics", conditionLabel(condition.featuresWorking)],
                ["Keys / remotes", conditionLabel(condition.keysCount)],
                ["ZIP code", condition.zip],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-card p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Safety & recalls row ── */}
        <div className="mb-10 flex flex-wrap gap-4">
          {safetyOverall && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map((n) => (
                  <Star key={n} className={`h-4 w-4 ${Number(safetyOverall) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold">NHTSA Safety: {safetyOverall}/5</p>
                <p className="text-xs text-muted-foreground">Overall crash rating</p>
              </div>
            </div>
          )}
          <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${recallCount > 0 ? "border-amber-800/40 bg-amber-950/20" : "border-emerald-800/40 bg-emerald-950/20"}`}>
            {recallCount > 0
              ? <AlertTriangle className="h-5 w-5 text-amber-400" />
              : <ShieldCheck className="h-5 w-5 text-emerald-400" />
            }
            <div>
              <p className={`text-sm font-semibold ${recallCount > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                {recallCount > 0 ? `${recallCount} open recall${recallCount !== 1 ? "s" : ""}` : "No open recalls"}
              </p>
              <p className="text-xs text-muted-foreground">
                {recallCount > 0 ? "NHTSA safety recalls — check nhtsa.gov" : "NHTSA recall check passed"}
              </p>
            </div>
          </div>
          {avgDaysOnMarket && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <Clock className="h-5 w-5 text-indigo-400" />
              <div>
                <p className="text-sm font-semibold">{avgDaysOnMarket} days avg. to sell</p>
                <p className="text-xs text-muted-foreground">Similar cars in your area</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
            <BarChart2 className="h-5 w-5 text-indigo-400" />
            <div>
              <p className="text-sm font-semibold">{appraisal.comparables} market comps · {appraisal.confidence}% confidence</p>
              <p className="text-xs text-muted-foreground">Live dealer listings within 100 mi</p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border/50 pt-8 print:pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground/60">
                Generated by AutoIQ on {generatedAt}. Values are estimates based on live market data and are not a guarantee of offer. Actual offers from Carvana, CarMax, or any other buyer may differ based on in-person inspection.
              </p>
            </div>
            <Link href="/appraise" className="shrink-0 print:hidden">
              <Button variant="outline" className="rounded-xl">
                Get your own report
              </Button>
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Loading report…
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
