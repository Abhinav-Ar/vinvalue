"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, BarChart3, CarFront, Check, Search, ShieldCheck } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VehiclePhoto from "@/components/VehiclePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function Dashboard() {
  const [garage, setGarage] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/garage").then((r) => r.json()), fetch("/api/history").then((r) => r.json())])
      .then(([garageData, historyData]) => { setGarage(garageData.cars || []); setActivity(historyData.searches || []); })
      .finally(() => setLoading(false));
  }, []);

  const portfolio = garage.reduce((sum, car) => sum + Number(car.trade_in || 0), 0);
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="eyebrow">Your workspace</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Know where every car stands.</h1></div>
        <Button asChild className="h-11 rounded-xl"><Link href="/appraise">New appraisal <ArrowRight /></Link></Button>
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {[
          ["Garage value", loading ? "—" : money(portfolio), "Estimated instant-sale total"],
          ["Vehicles", loading ? "—" : garage.length, "Saved and ready to revisit"],
          ["Recent appraisals", loading ? "—" : activity.length, "Latest report per VIN"],
        ].map(([label, value, note]) => <div key={label} className="rounded-2xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Garage</h2><p className="mt-1 text-sm text-muted-foreground">The latest value for each saved vehicle.</p></div><Link href="/garage" className="text-sm font-medium">View all</Link></div>
        {!loading && garage.length === 0 ? <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center"><CarFront className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-4 font-medium">No vehicles saved yet</p><p className="mt-1 text-sm text-muted-foreground">Your first appraisal can be saved here.</p></div> : <div className="grid gap-4 lg:grid-cols-3">{garage.slice(0, 3).map((car) => <Link href="/garage" key={car.id} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg"><VehiclePhoto car={car} className="vehicle-photo-curated" /><div className="p-5"><p className="font-semibold">{car.year} {car.make} {car.model}</p><p className="mt-1 text-xs text-muted-foreground">{Number(car.mileage).toLocaleString()} mi · {car.condition}</p><div className="mt-5 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Instant-sale estimate</p><p className="mt-1 text-2xl font-semibold">{money(car.trade_in)}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" /></div></div></Link>)}</div>}
      </section>
    </main>
  );
}

function Landing() {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const go = () => router.push(vin.length === 17 ? `/appraise?vin=${vin}` : "/appraise");
  return (
    <main>
      <section className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div>
          <p className="eyebrow">Evidence-backed vehicle values</p>
          <h1 className="display-title mt-5 max-w-3xl">Know what your car is worth—and why.</h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">AutoIQ turns live comparable listings and your vehicle’s condition into a clear value range you can actually negotiate with.</p>
          <div className="surface mt-9 max-w-xl p-2 sm:flex">
            <Input value={vin} onChange={(event) => setVin(event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))} onKeyDown={(event) => event.key === "Enter" && go()} placeholder="Enter your VIN" aria-label="Enter your VIN" className="h-13 flex-1 border-0 bg-transparent px-4 font-mono shadow-none focus-visible:ring-0" />
            <Button onClick={go} className="h-13 w-full rounded-2xl px-6 sm:w-auto">Check my car <ArrowRight /></Button>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">{["No account required", "Live market evidence", "Method shown"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{item}</span>)}</div>
        </div>

        <div className="relative">
          <div className="surface overflow-hidden">
            <div className="border-b border-border bg-muted/70 p-7 text-foreground">
              <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[.16em] text-muted-foreground">Example appraisal</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">Strong evidence</span></div>
              <p className="mt-8 text-sm text-muted-foreground">Likely instant-sale value</p><p className="mt-2 text-5xl font-semibold tracking-[-.05em]">$23,100</p><p className="mt-2 text-sm text-muted-foreground">$21,500–$24,800</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border"><div className="bg-card p-6"><p className="text-xs text-muted-foreground">Private sale</p><p className="mt-2 text-2xl font-semibold">$27,450</p></div><div className="bg-card p-6"><p className="text-xs text-muted-foreground">Dealer retail</p><p className="mt-2 text-2xl font-semibold">$31,900</p></div></div>
            <div className="flex items-center gap-3 border-t border-border p-5 text-sm text-muted-foreground"><Search className="h-4 w-4" /> Built from 18 comparable listings near 94538</div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">
          {[
            [Search, "Current market", "Active listings are filtered for mileage proximity and pricing outliers."],
            [BarChart3, "Honest ranges", "We show uncertainty instead of pretending a single number is guaranteed."],
            [ShieldCheck, "Visible methodology", "Every material adjustment stays available in the report."],
          ].map(([Icon, title, copy]) => <article key={title}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></span><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></article>)}
        </div>
      </section>
    </main>
  );
}

export default function HomePage() {
  const { status } = useSession();
  return <div className="min-h-screen"><SiteHeader />{status === "authenticated" ? <Dashboard /> : <Landing />}<footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>AutoIQ</span><span>VIN data via NHTSA · Market evidence via MarketCheck</span></footer></div>;
}
