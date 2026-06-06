"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Search, BarChart3, Car, ArrowRight, DollarSign, Clock, Plus, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import SellProfilePrompt from "@/components/SellProfilePrompt";
import { decodeProfile } from "@/lib/profileEncoding";

function money(v) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function Nav({ links = true }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <Zap className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-semibold">AutoIQ</span>
        </Link>
        {links && (
          <nav className="hidden items-center gap-1 sm:flex">
            <Link href="/appraise" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Appraise</Link>
            <Link href="/garage" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Garage</Link>
          </nav>
        )}
        <UserMenu />
      </div>
    </header>
  );
}

function GarageCard({ car }) {
  const decoded = car.profile_encoded ? decodeProfile(car.profile_encoded) : null;
  const stored = decoded?.vehiclePhoto ?? null;
  const exteriorColor = decoded?.condition?.exteriorColor || "";
  const [vehiclePhoto, setVehiclePhoto] = useState(stored);

  useEffect(() => {
    if (!exteriorColor && stored) { setVehiclePhoto(stored); return; }
    const params = new URLSearchParams({ make: car.make, model: car.model, year: car.year });
    if (exteriorColor) params.set("color", exteriorColor);
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.photo) setVehiclePhoto(d.photo); else setVehiclePhoto(stored); })
      .catch(() => { setVehiclePhoto(stored); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car.vin, exteriorColor]);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20">
      {vehiclePhoto && (
        <div className="overflow-hidden border-b border-border bg-muted relative aspect-video">
          <img src={vehiclePhoto} alt={`${car.year} ${car.make} ${car.model}`} className="absolute left-0 w-full object-cover" style={{ top: "-12%", height: "112%" }} loading="lazy" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold leading-snug">
              {car.year} {car.make} {car.model}
            </p>
            {car.trim && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{car.trim}</p>
            )}
          </div>
          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            {car.condition}
          </span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {Number(car.mileage).toLocaleString()} miles
        </p>

        {/* Hero value */}
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Est. instant offer</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{money(car.trade_in)}</p>
        </div>

        {/* Secondary values */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Private party</p>
            <p className="mt-0.5 text-sm font-semibold">{money(car.private_party)}</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Retail</p>
            <p className="mt-0.5 text-sm font-semibold">{money(car.retail)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-border p-3">
        <Link href={`/appraise?vin=${car.vin}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
            Re-appraise
          </Button>
        </Link>
        {car.profile_encoded && (
          <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
            <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1">
              Report <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function Dashboard({ session, garage, history }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const totalCars = garage.length;
  const bestOffer = totalCars > 0 ? Math.max(...garage.map((c) => Number(c.trade_in) || 0)) : 0;
  const totalAppraisals = history.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="mx-auto max-w-6xl px-6 py-12">

        {/* Top bar */}
        <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting}</p>
            <h1 className="mt-0.5 text-3xl font-bold tracking-tight">{firstName}.</h1>
          </div>
          <Link href="/appraise">
            <Button className="rounded-lg gap-2">
              <Plus className="h-4 w-4" /> New appraisal
            </Button>
          </Link>
        </div>

        {/* Incomplete sell profile prompt */}
        <SellProfilePrompt cars={garage} />

        {/* Stats row */}
        {totalCars > 0 && (
          <div className="mb-10 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Cars in garage", value: String(totalCars), sub: totalCars === 1 ? "vehicle tracked" : "vehicles tracked" },
              { label: "Best instant offer", value: money(bestOffer), sub: "estimated trade-in" },
              { label: "Total appraisals", value: String(totalAppraisals), sub: "searches run" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Garage */}
        {totalCars > 0 ? (
          <section className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Garage</h2>
              <Link href="/garage" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                View all →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {garage.slice(0, 3).map((car) => (
                <GarageCard key={car.id} car={car} />
              ))}
              <Link
                href="/appraise"
                className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-border transition-colors hover:border-foreground/20 hover:bg-muted/20"
              >
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Add a car</p>
                </div>
              </Link>
            </div>
          </section>
        ) : (
          /* Empty garage onboarding */
          <section className="mb-12">
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
                <Car className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold">Your garage is empty</p>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
                Run an appraisal to find out what your car is worth, then save it here to track it over time.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/appraise">
                  <Button className="rounded-lg gap-2">
                    Appraise a car <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/value">
                  <Button variant="outline" className="rounded-lg">Quick value check</Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Recent searches */}
        {history.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent appraisals</h2>
              <Link href="/history" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                View all →
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {history.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                      <Car className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.year} {s.make} {s.model}
                        {s.trim && <span className="ml-1.5 font-normal text-muted-foreground text-xs">{s.trim}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Number(s.mileage).toLocaleString()} mi · {s.condition} · {timeAgo(s.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-5">
                    <div className="hidden text-right sm:block">
                      <p className="text-[11px] text-muted-foreground">Trade-in</p>
                      <p className="text-sm font-semibold">{money(s.trade_in)}</p>
                    </div>
                    <div className="hidden text-right lg:block">
                      <p className="text-[11px] text-muted-foreground">Private</p>
                      <p className="text-sm font-semibold">{money(s.private_party)}</p>
                    </div>
                    {s.profile_encoded && (
                      <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1" asChild>
                        <Link href={`/profile?d=${s.profile_encoded}`} target="_blank">
                          Report <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Decode your VIN",
    desc: "Enter your 17-character VIN. We pull the exact make, model, trim, engine, and drivetrain from the NHTSA database instantly.",
  },
  {
    step: "02",
    title: "Add your details",
    desc: "Mileage, ZIP code, condition, title status, accident history — everything that changes what your car is actually worth.",
  },
  {
    step: "03",
    title: "Get your valuation",
    desc: "We compare live market listings and calculate a fair price range adjusted to your car's exact circumstances — in seconds.",
  },
];

export default function Landing() {
  const { data: session, status } = useSession();
  const [garage, setGarage] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/garage").then((r) => r.json()),
      fetch("/api/history").then((r) => r.json()),
    ]).then(([g, h]) => {
      setGarage(g.cars ?? []);
      setHistory((h.searches ?? []).slice(0, 5));
    });
  }, [status]);

  // Never fall through to the landing page while the session or data is still resolving.
  // This prevents the flash where authenticated users briefly see the marketing page.
  if (status === "loading" || (status === "authenticated" && (garage === null || history === null))) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Nav links={false} />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-10">
            <div className="h-3.5 w-24 animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-8 w-36 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="mb-10 grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
          <div className="mb-4 h-3.5 w-16 animate-pulse rounded-md bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (status === "authenticated") {
    return <Dashboard session={session} garage={garage} history={history} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* Hero */}
      <section className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl"
        >
          <p className="mb-6 text-sm text-muted-foreground">Free · No account needed · Results in seconds</p>
          <h1 className="text-6xl font-bold leading-[1.08] tracking-tight sm:text-7xl">
            Know what your
            <br />
            car is worth.
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            Real-time valuation from live market listings — adjusted for your car's exact mileage, condition, and history.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/appraise">
              <Button size="lg" className="h-11 rounded-xl px-7 text-sm gap-2">
                Appraise your car <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>


      {/* How it works */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">How it works</p>
          </div>
          <h2 className="mb-16 text-3xl font-bold tracking-tight">Three steps to a fair price</h2>
          <div className="grid gap-10 md:grid-cols-3">
            {STEPS.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <span className="text-5xl font-bold text-muted-foreground/15">{step}</span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-5xl font-bold tracking-tight">
            Your VIN.
            <br />
            Your number.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            No subscription. No signup required. Just your VIN and the truth.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/appraise">
              <Button size="lg" className="h-11 rounded-xl px-7 text-sm gap-2">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-foreground">
              <Zap className="h-3 w-3 text-background" />
            </div>
            <span className="text-sm font-semibold">AutoIQ</span>
          </div>
          <p className="text-xs text-muted-foreground">VIN data via NHTSA · Listings via MarketCheck</p>
        </div>
      </footer>
    </div>
  );
}
