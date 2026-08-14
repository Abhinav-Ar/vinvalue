"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap, Copy, Check, AlertTriangle, ShieldCheck,
  Star, Clock, BarChart2, ExternalLink, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { decodeProfile, verifyProfile } from "@/lib/profileEncoding";
import { marketPhotoProxyUrl } from "@/lib/marketPhoto";

function money(v) {
  if (!Number.isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function buildBuyerGuide(condition) {
  const { mileage, titleStatus, accidents, warningLights, mechanicalIssues, bodyDamage, featuresWorking, keysCount } = condition;
  const noAccidents = accidents === "No";
  const hasLien = titleStatus === "Lien";
  const keyNum = keysCount === "Both sets" ? "2" : keysCount === "One set" ? "1" : "0";

  return {
    carvana: [
      { q: "Odometer reading", a: `${Number(mileage).toLocaleString()} miles` },
      { q: "Any accidents on record?", a: noAccidents ? "No accidents" : "Yes — reported" },
      { q: "Warning lights on?", a: warningLights === "None" ? "No" : `Yes — ${warningLights.toLowerCase()}` },
      { q: "Visible body / paint damage?", a: bodyDamage === "None" ? "No damage" : `Yes — ${bodyDamage.toLowerCase()}` },
      { q: "Do all features work?", a: featuresWorking === "Yes" ? "Yes, all working" : `Issues — ${featuresWorking.toLowerCase()}` },
      { q: "Major mechanical problems?", a: mechanicalIssues === "None" ? "No" : `Yes — ${mechanicalIssues.toLowerCase()}` },
      { q: "Lien on the car?", a: hasLien ? "Yes — has a lien" : "No lien" },
      { q: "Key fobs / remotes", a: keyNum },
    ],
    carmax: [
      { q: "Odometer reading", a: `${Number(mileage).toLocaleString()} miles` },
      { q: "Accidents?", a: noAccidents ? "No" : "Yes" },
      { q: "Known mechanical problems?", a: mechanicalIssues === "None" ? "No" : `Yes — ${mechanicalIssues.toLowerCase()}` },
      { q: "Warning or check engine lights?", a: warningLights === "None" ? "No" : `Yes — ${warningLights.toLowerCase()}` },
      { q: "Exterior condition", a: bodyDamage === "None" ? "Clean — no damage" : `${bodyDamage} damage present` },
      { q: "Do all electronics work?", a: featuresWorking === "Yes" ? "Yes" : `No — ${featuresWorking.toLowerCase()}` },
      { q: "Own it outright (no loan)?", a: hasLien ? "No — has a lien" : "Yes" },
      { q: "Number of keys", a: keyNum },
    ],
  };
}

function issueLevel(condition) {
  const count = [
    condition.warningLights !== "None",
    condition.mechanicalIssues !== "None",
    condition.bodyDamage !== "None",
    condition.featuresWorking !== "Yes",
    condition.accidents === "Yes",
  ].filter(Boolean).length;
  if (count === 0) return { label: "Clean", cls: "text-emerald-300" };
  if (count <= 1) return { label: "Minor issues", cls: "text-amber-300" };
  return { label: "Multiple issues", cls: "text-red-300" };
}

function conditionDisplay(val) {
  const good = ["None", "Clean", "Yes", "No", "Both sets", "Full dealer", "Full independent"];
  const bad  = ["Major", "Salvage", "Multiple", "No keys", "Major issues"];
  if (good.includes(val)) return { text: val, cls: "text-emerald-300" };
  if (bad.some((b) => val?.includes?.(b))) return { text: val, cls: "text-red-300" };
  return { text: val, cls: "text-foreground" };
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
    }} className="gap-2 rounded-lg print:hidden">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d");
  const profile = useMemo(() => encoded ? decodeProfile(encoded) : null, [encoded]);
  const [displayPhoto, setDisplayPhoto] = useState(() => marketPhotoProxyUrl(profile?.vehiclePhoto));
  const [verified, setVerified] = useState(null);

  useEffect(() => {
    if (!encoded) return;
    verifyProfile(encoded).then(setVerified).catch(() => setVerified(false));
  }, [encoded]);

  useEffect(() => {
    if (!profile?.vehicle?.make) return;
    const { vehicle, condition } = profile;
    const params = new URLSearchParams({ make: vehicle.make, model: vehicle.model, year: vehicle.year });
    if (condition.exteriorColor) params.set("color", condition.exteriorColor);
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((d) => d.photo && setDisplayPhoto(d.photo))
      .catch(() => {});
  }, [profile]);

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-muted-foreground">This profile link is invalid or expired.</p>
        <Link href="/appraise"><Button className="rounded-lg">Run a new appraisal</Button></Link>
      </div>
    );
  }

  const { vehicle, condition, appraisal, recallCount, safetyOverall, avgDaysOnMarket, generatedAt, vin } = profile;
  const guide  = buildBuyerGuide(condition);
  const status = issueLevel(condition);
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";
  const hasExtended = condition.exteriorColor || condition.tireCondition;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm print:static">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">AutoIQ</span>
          </Link>
          <div className="flex items-center gap-2 print:hidden">
            <CopyButton url={currentUrl} />
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 rounded-lg">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">

        {/* ── Hero: photo + title ── */}
        {displayPhoto ? (
          <div className="mb-10 overflow-hidden rounded-xl border border-border relative">
            <div className="relative aspect-[21/9] overflow-hidden bg-muted">
              {/* Remote dealer imagery is dynamic and cannot be safely allowlisted for next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayPhoto}
                alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                className="absolute left-0 w-full object-cover"
                style={{ top: "-12%", height: "112%" }}
              />
              {/* bottom gradient for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6">
                <p className="mb-1 text-xs uppercase tracking-widest text-white/60">Seller&apos;s report</p>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.trim && <span className="ml-2 text-xl font-normal text-white/70">{vehicle.trim}</span>}
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  {Number(condition.mileage).toLocaleString()} mi · {condition.condition} · {condition.titleStatus} title
                  {condition.accidents === "Yes" ? " · Accident reported" : ""}
                </p>
              </div>
              <div className="absolute top-4 right-4">
                <span className={`rounded-md border border-white/20 bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${status.cls}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-10">
            <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Seller&apos;s report</p>
            <h1 className="text-4xl font-bold tracking-tight">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim && <span className="ml-3 text-2xl font-normal text-muted-foreground">{vehicle.trim}</span>}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {Number(condition.mileage).toLocaleString()} mi · {condition.condition} · {condition.titleStatus} title
              {condition.accidents === "Yes" ? " · Accident reported" : ""}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground/60">{vin}</p>
          </div>
        )}

        {/* VIN + meta row */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs">{vin}</span>
          <span className={`rounded-md border px-3 py-1.5 text-xs font-medium ${verified ? "border-primary/30 bg-primary/10 text-primary" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
            {verified ? "Integrity checked" : verified === false ? "Legacy / unsigned report" : "Checking integrity…"}
          </span>
          <span className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
          {recallCount > 0 && (
            <span className="rounded-md border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              {recallCount} model campaign{recallCount !== 1 ? "s" : ""} to verify by VIN
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground print:ml-0">Generated {generatedAt}</span>
        </div>
        <p className="-mt-5 mb-8 text-xs text-muted-foreground">Condition details are seller-provided. Integrity checking detects changes to signed reports; it does not independently verify the vehicle.</p>

        {/* ── Values ── */}
        <div className="mb-10 overflow-hidden rounded-xl border border-border">
          <div className="grid divide-y divide-border sm:divide-x sm:divide-y-0 sm:grid-cols-3">
            {[
              { label: "Trade-in / Instant offer", sub: "Carvana, CarMax, dealers", value: appraisal.tradeIn, range: appraisal.tradeInRange },
              { label: "Private party", sub: "Facebook Marketplace, Craigslist", value: appraisal.privateParty, range: appraisal.privatePartyRange },
              { label: "Dealer retail", sub: "What dealers resell it for", value: appraisal.retail, range: appraisal.retailRange },
            ].map(({ label, sub, value, range }) => (
              <div key={label} className="bg-card p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-3 text-4xl font-bold tracking-tight">{money(value)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{money(range.low)} – {money(range.high)}</p>
                <p className="mt-1 text-xs text-muted-foreground/50">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Buyer Q&A guides ── */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {[
            { buyer: "Carvana", url: "https://www.carvana.com/sell-my-car", items: guide.carvana },
            { buyer: "CarMax",  url: "https://www.carmax.com/sell-my-car",  items: guide.carmax  },
          ].map(({ buyer, url, items }) => (
            <div key={buyer} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Quick reference</p>
                  <p className="mt-0.5 text-sm font-semibold">{buyer} will ask you…</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5 text-xs print:hidden" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <div className="divide-y divide-border">
                {items.map(({ q, a }) => (
                  <div key={q} className="flex items-start justify-between gap-4 px-5 py-3">
                    <p className="text-sm text-muted-foreground">{q}</p>
                    <p className="shrink-0 text-right text-sm font-medium max-w-[45%]">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Condition summary ── */}
        <div className="mb-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Condition</p>
            <p className="mt-0.5 text-sm font-semibold">What was reported about this car</p>
          </div>
          <div className="grid gap-px p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Mileage",              `${Number(condition.mileage).toLocaleString()} miles`],
              ["Overall condition",    condition.condition],
              ["Title status",         condition.titleStatus],
              ["Accident history",     condition.accidents === "No" ? "None reported" : "Reported"],
              ["Service history",      condition.serviceHistory],
              ["Owners",               condition.owners === "1" ? "1 owner" : condition.owners === "2" ? "2 owners" : "3+ owners"],
              ["Warning lights",       condition.warningLights],
              ["Mechanical",           condition.mechanicalIssues],
              ["Body / exterior",      condition.bodyDamage],
              ["Features & electronics", condition.featuresWorking],
              ["Keys / remotes",       condition.keysCount],
              ["ZIP code",             condition.zip],
            ].map(([label, value]) => {
              const d = conditionDisplay(value);
              return (
                <div key={label} className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`mt-0.5 text-sm font-medium ${d.cls}`}>{d.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Extended sell profile ── */}
        {hasExtended && (
          <div className="mb-10 overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Appearance & interior</p>
              <p className="mt-0.5 text-sm font-semibold">Additional details</p>
            </div>
            <div className="grid gap-px p-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                condition.exteriorColor    && ["Exterior color",      condition.exteriorColor],
                condition.interiorColor    && ["Interior color",      condition.interiorColor],
                condition.tireCondition    && ["Tires",               condition.tireCondition],
                condition.glassCondition   && ["Windshield / glass",  condition.glassCondition],
                condition.interiorCleanliness && ["Interior",         condition.interiorCleanliness],
                condition.odors            && ["Odors",               condition.odors],
                condition.roofType         && ["Roof type",           condition.roofType],
              ].filter(Boolean).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Safety & market stats ── */}
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {safetyOverall && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex gap-0.5 shrink-0">
                {[1,2,3,4,5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${Number(safetyOverall) >= n ? "fill-foreground text-foreground" : "text-muted-foreground/20"}`} />
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Safety {safetyOverall}/5</p>
                <p className="text-xs text-muted-foreground">NHTSA overall</p>
              </div>
            </div>
          )}
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${recallCount > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
            {recallCount > 0
              ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              : <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
            }
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${recallCount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                {recallCount > 0 ? `${recallCount} open recall${recallCount !== 1 ? "s" : ""}` : "No open recalls"}
              </p>
              <p className="text-xs text-muted-foreground">NHTSA check</p>
            </div>
          </div>
          {avgDaysOnMarket && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">{avgDaysOnMarket}d avg to sell</p>
                <p className="text-xs text-muted-foreground">Similar cars nearby</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <BarChart2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">{appraisal.comparables} comps</p>
              <p className="text-xs text-muted-foreground">{appraisal.confidence}% confidence</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground/50 max-w-lg">
            Generated by AutoIQ on {generatedAt}. Values are estimates based on live market data and are not a guarantee of offer.
            Actual offers may differ based on in-person inspection.
          </p>
          <Link href="/appraise" className="shrink-0 print:hidden">
            <Button variant="outline" size="sm" className="rounded-lg">Get your own report</Button>
          </Link>
        </div>

      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">Loading…</div>}>
      <ProfileContent />
    </Suspense>
  );
}
