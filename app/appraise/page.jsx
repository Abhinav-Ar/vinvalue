"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, CarFront, Check, ChevronDown, ExternalLink, Loader2, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VehiclePhoto from "@/components/VehiclePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { encodeProfile, signProfile } from "@/lib/profileEncoding";

const defaults = {
  mileage: "65000", zip: "94538", condition: "Good", titleStatus: "Clean",
  accidents: "No", serviceHistory: "Partial", owners: "1", warningLights: "None",
  mechanicalIssues: "None", bodyDamage: "None", featuresWorking: "Yes", keysCount: "Both sets",
};

const fields = [
  ["condition", "Overall condition", ["Excellent", "Good", "Fair", "Poor"]],
  ["titleStatus", "Title", ["Clean", "Lien", "Rebuilt", "Salvage"]],
  ["accidents", "Accident history", ["No", "Yes"]],
];

const advancedFields = [
  ["serviceHistory", "Service records", ["Full dealer", "Full independent", "Partial", "None"]],
  ["owners", "Prior owners", ["1", "2", "3", "4"]],
  ["warningLights", "Warning lights", ["None", "Check engine", "Multiple"]],
  ["mechanicalIssues", "Mechanical issues", ["None", "Minor", "Major"]],
  ["bodyDamage", "Body damage", ["None", "Minor", "Moderate", "Major"]],
  ["featuresWorking", "Features", ["Yes", "Minor issues", "Major issues"]],
  ["keysCount", "Keys", ["Both sets", "One set", "No keys"]],
];

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function Field({ label, children }) {
  return <label className="space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function Confidence({ value, comps }) {
  const label = value >= 80 ? "Strong evidence" : value >= 65 ? "Good evidence" : "Limited evidence";
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
      <span><strong className="font-medium text-foreground">{label}</strong> · {comps} comparable{comps === 1 ? "" : "s"}</span>
    </div>
  );
}

export default function AppraisePage() {
  const { data: session } = useSession();
  const [vin, setVin] = useState(() => typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("vin") || "").toUpperCase());
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState(defaults);
  const [step, setStep] = useState("vin");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const title = vehicle ? `${vehicle.ModelYear} ${vehicle.Make} ${vehicle.Model}${vehicle.Trim ? ` ${vehicle.Trim}` : ""}` : "";
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  async function decode() {
    const clean = vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) { setError("Enter all 17 VIN characters."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/decode?vin=${clean}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVehicle(data.vehicle); setVin(clean); setStep("details");
    } catch (err) { setError(err.message || "VIN lookup failed."); }
    finally { setBusy(false); }
  }

  async function appraise() {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({
        vin: vehicle.VIN, year: vehicle.ModelYear, make: vehicle.Make, model: vehicle.Model,
        trim: vehicle.Trim || "", body: vehicle.BodyClass || "", drive: vehicle.DriveType || "",
        fuel: vehicle.FuelTypePrimary || "", ...form,
      });
      const response = await fetch(`/api/appraise?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data); setStep("results");

      if (session?.user) {
        const encoded = await createReport(data);
        fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(historyPayload(data, encoded)) }).catch(() => {});
      }
    } catch (err) { setError(err.message || "We could not calculate a value."); }
    finally { setBusy(false); }
  }

  function profilePayload(data = result) {
    return {
      decoded: vehicle, ...form, appraisal: data.appraisal, recalls: data.recalls || [],
      safetyRating: data.safetyRating, marketStats: data.marketStats, vehiclePhoto: data.vehiclePhoto,
    };
  }

  async function createReport(data = result) {
    return signProfile(encodeProfile(profilePayload(data)));
  }

  function historyPayload(data, encoded) {
    return {
      vin: vehicle.VIN, make: vehicle.Make, model: vehicle.Model, year: vehicle.ModelYear,
      trim: vehicle.Trim, mileage: form.mileage, condition: form.condition, zip: form.zip,
      tradeIn: data.appraisal.tradeIn, privateParty: data.appraisal.privateParty,
      retail: data.appraisal.retail, profileEncoded: encoded,
    };
  }

  async function saveVehicle() {
    if (!session?.user) { signIn("google"); return; }
    setBusy(true); setError("");
    try {
      const encoded = await createReport();
      const response = await fetch("/api/garage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...historyPayload(result, encoded), profileEncoded: encoded }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not save vehicle.");
      setSaved(true);
      window.dispatchEvent(new CustomEvent("autoiq:garage-saved"));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function openReport() {
    const token = await createReport();
    window.open(`/profile?d=${token}`, "_blank", "noopener,noreferrer");
  }

  const evidenceNote = useMemo(() => {
    if (!result) return "";
    const basis = result.comparisonBasis;
    const searched = result.searchStages || [];
    if (basis === "exact-local") return "Exact-year listings near your ZIP";
    if (basis === "adjacent-model-years-local") return "Nearby listings including adjacent model years";
    if (basis === "exact-state") return "Exact-year listings expanded across your state";
    if (basis === "adjacent-model-years-state") return "Statewide listings including adjacent model years";
    if (basis.startsWith("new-inventory")) return "Current new inventory and VIN pricing data";
    if (searched.includes("adjacent-model-years-state")) return "No active statewide matches after including adjacent model years; VIN and aggregate market data used";
    if (searched.includes("exact-state")) return "No active exact-year matches statewide; VIN and aggregate market data used";
    if (searched.includes("adjacent-model-years-local")) return "No nearby matches after including adjacent model years; VIN and aggregate market data used";
    return "VIN pricing data; inventory evidence is limited";
  }, [result]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {step !== "vin" && (
          <button onClick={() => { setStep(step === "results" ? "details" : "vin"); setError(""); }} className="mb-7 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {step === "results" ? "Adjust vehicle details" : "Use a different VIN"}
          </button>
        )}

        {step === "vin" && (
          <section className="mx-auto max-w-2xl py-10 sm:py-20">
            <p className="eyebrow">Vehicle appraisal</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-.055em] sm:text-6xl">Start with the car.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">Enter the VIN. We’ll identify the exact vehicle before asking only for the details that materially change its value.</p>
            <div className="surface mt-10 p-3 sm:flex">
              <Input value={vin} onChange={(event) => setVin(event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))} onKeyDown={(event) => event.key === "Enter" && decode()} placeholder="17-character VIN" aria-label="17-character VIN" className="h-14 flex-1 border-0 bg-transparent px-4 font-mono text-base shadow-none focus-visible:ring-0" />
              <Button onClick={decode} disabled={busy} className="h-14 w-full rounded-2xl px-7 sm:w-auto">{busy ? <Loader2 className="animate-spin" /> : <>Identify vehicle <ArrowRight /></>}</Button>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>VINs never contain I, O, or Q</span><span>{vin.length}/17</span></div>
            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </section>
        )}

        {step === "details" && vehicle && (
          <section className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background"><CarFront /></span>
              <div><p className="eyebrow">Vehicle identified</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{[vehicle.BodyClass, vehicle.DriveType, vehicle.FuelTypePrimary].filter(Boolean).join(" · ")}</p></div>
            </div>

            <div className="surface p-6 sm:p-8">
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Current mileage"><Input inputMode="numeric" value={form.mileage} onChange={(event) => setField("mileage", event.target.value.replace(/\D/g, ""))} className="h-12 rounded-xl" /></Field>
                <Field label="ZIP code"><Input inputMode="numeric" value={form.zip} onChange={(event) => setField("zip", event.target.value.replace(/\D/g, "").slice(0, 5))} className="h-12 rounded-xl" /></Field>
                {fields.map(([name, label, options]) => <Field key={name} label={label}><Select value={form[name]} onValueChange={(value) => setField(name, value)}><SelectTrigger className="h-12 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem value={option} key={option}>{option === "No" && name === "accidents" ? "None reported" : option}</SelectItem>)}</SelectContent></Select></Field>)}
              </div>

              <details className="mt-7 border-t border-border pt-6">
                <summary className="flex list-none items-center justify-between text-sm font-medium"><span>Refine the estimate <span className="font-normal text-muted-foreground">· optional</span></span><ChevronDown className="h-4 w-4" /></summary>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">{advancedFields.map(([name, label, options]) => <Field key={name} label={label}><Select value={form[name]} onValueChange={(value) => setField(name, value)}><SelectTrigger className="h-12 w-full rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem value={option} key={option}>{option}</SelectItem>)}</SelectContent></Select></Field>)}</div>
              </details>

              {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6"><p className="hidden max-w-md text-xs leading-relaxed text-muted-foreground sm:block">Estimate based on active asking prices, not guaranteed sale proceeds.</p><Button onClick={appraise} disabled={busy} className="h-12 w-full rounded-xl px-7 sm:w-auto">{busy ? <><Loader2 className="animate-spin" /> Analyzing market</> : <>Calculate value <ArrowRight /></>}</Button></div>
            </div>
          </section>
        )}

        {step === "results" && result && (
          <section>
            <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_70px_rgba(50,35,20,.08)] lg:grid-cols-[1.08fr_.92fr]">
              <VehiclePhoto car={{ year: vehicle.ModelYear, make: vehicle.Make, model: vehicle.Model, trim: vehicle.Trim }} storedPhoto={result.vehiclePhoto} className="vehicle-photo-curated min-h-72 border-b border-border lg:h-full lg:[aspect-ratio:auto] lg:border-b-0 lg:border-r" priority />
              <div className="p-7 sm:p-10">
                <p className="eyebrow">Estimated instant-sale value</p>
                <p className="mt-4 text-6xl font-semibold tracking-[-.06em]">{money(result.appraisal.tradeIn)}</p>
                <p className="mt-2 text-sm text-muted-foreground">Likely range {money(result.appraisal.tradeInRange.low)}–{money(result.appraisal.tradeInRange.high)}</p>
                <div className="my-7 h-px bg-border" />
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {Number(form.mileage).toLocaleString()} mi · ZIP {form.zip}</p>
                <div className="mt-5"><Confidence value={result.appraisal.confidence} comps={result.appraisal.comparables} /></div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ["Instant sale", result.appraisal.tradeIn, result.appraisal.tradeInRange, "Fastest, least work"],
                ["Private sale", result.appraisal.privateParty, result.appraisal.privatePartyRange, `${money(result.appraisal.privateParty - result.appraisal.tradeIn)} more potential`],
                ["Dealer retail", result.appraisal.retail, result.appraisal.retailRange, "What similar cars are advertised for"],
              ].map(([label, value, range, note], index) => <article key={label} className={`rounded-2xl border p-5 ${index === 0 ? "border-primary/40 bg-orange-50" : "border-border bg-card"}`}><p className="text-sm font-medium">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{money(value)}</p><p className="mt-1 text-xs text-muted-foreground">{money(range.low)}–{money(range.high)}</p><p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">{note}</p></article>)}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                <details className="rounded-2xl border border-border bg-card p-5">
                  <summary className="flex list-none items-center justify-between"><span><strong className="text-sm">Market evidence</strong><span className="ml-2 text-xs text-muted-foreground">{evidenceNote}</span></span><ChevronDown className="h-4 w-4" /></summary>
                  <div className="mt-5 divide-y divide-border border-t border-border">
                    {result.listings.slice(0, 8).map((listing) => <div key={listing.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{listing.title}</p><p className="mt-1 text-xs text-muted-foreground">{Number(listing.mileage).toLocaleString()} mi{listing.location ? ` · ${listing.location}` : ""}</p></div><div className="flex shrink-0 items-center gap-3"><strong className="text-sm">{money(listing.price)}</strong>{listing.url !== "#" && <a href={listing.url} target="_blank" rel="noreferrer" aria-label="Open listing"><ExternalLink className="h-4 w-4 text-muted-foreground" /></a>}</div></div>)}
                  </div>
                </details>
                <details className="rounded-2xl border border-border bg-card p-5">
                  <summary className="flex list-none items-center justify-between"><span className="text-sm font-medium">How this estimate was calculated</span><ChevronDown className="h-4 w-4" /></summary>
                  <div className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
                    {Object.entries(result.appraisal.adjustments).filter(([, value]) => value !== 0).map(([name, value]) => <div key={name} className="flex justify-between rounded-xl bg-muted px-4 py-3 text-sm"><span className="capitalize text-muted-foreground">{name.replace(/([A-Z])/g, " $1")}</span><strong>{name === "mileage" || name === "recalls" ? money(value) : `${value > 0 ? "+" : ""}${value}%`}</strong></div>)}
                    <p className="sm:col-span-2 text-xs leading-relaxed text-muted-foreground">{result.appraisal.methodology}. Estimates use asking-price evidence and may differ from completed sale prices.</p>
                  </div>
                </details>
              </div>

              <aside className="h-fit rounded-2xl bg-foreground p-6 text-background">
                <Sparkles className="h-5 w-5 text-orange-300" />
                <h2 className="mt-4 text-xl font-semibold">Your next move</h2>
                <p className="mt-2 text-sm leading-relaxed text-background/70">Get two real purchase offers and compare them with the instant-sale range. If both are low, private sale may justify the extra work.</p>
                <div className="mt-6 space-y-2">
                  <Button onClick={saveVehicle} disabled={busy || saved} className="h-11 w-full rounded-xl bg-background text-foreground hover:bg-background/90">{saved ? <><Check /> Saved to Garage</> : session?.user ? "Save to Garage" : "Sign in to save"}</Button>
                  <Button onClick={openReport} variant="ghost" className="h-11 w-full rounded-xl text-background hover:bg-white/10 hover:text-background">Open full report <ExternalLink /></Button>
                </div>
                <p className="mt-5 text-[11px] leading-relaxed text-background/50">AutoIQ does not buy vehicles or guarantee third-party offers.</p>
              </aside>
            </div>
            {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div className="mt-10 text-center"><Link href="/appraise" className="text-sm text-muted-foreground hover:text-foreground">Appraise another vehicle</Link></div>
          </section>
        )}
      </main>
    </div>
  );
}
