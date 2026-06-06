"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Search, BarChart3, Car, ArrowRight, DollarSign, Clock, Plus, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";

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
            <Link href="/value" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Value</Link>
            <Link href="/appraise" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Appraise</Link>
            <Link href="/garage" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Garage</Link>
          </nav>
        )}
        <UserMenu />
      </div>
    </header>
  );
}

function Dashboard({ session, garage, history }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">{greeting}, {firstName}.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Your AutoIQ dashboard.</p>
        </div>

        {/* Quick actions */}
        <div className="mb-10 flex flex-wrap gap-2">
          <Link href="/appraise">
            <Button size="sm" className="rounded-lg gap-2">
              <Plus className="h-3.5 w-3.5" /> New appraisal
            </Button>
          </Link>
          <Link href="/garage">
            <Button variant="outline" size="sm" className="rounded-lg gap-2">
              <Car className="h-3.5 w-3.5" /> Garage
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" size="sm" className="rounded-lg gap-2">
              <Clock className="h-3.5 w-3.5" /> History
            </Button>
          </Link>
        </div>

        {/* Garage */}
        {garage.length > 0 && (
          <div className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Garage</h2>
              <Link href="/garage" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {garage.slice(0, 4).map((car) => (
                <div key={car.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="p-4 pb-3">
                    <p className="truncate text-sm font-medium">{car.year} {car.make} {car.model}</p>
                    {car.trim && <p className="mt-0.5 truncate text-xs text-muted-foreground">{car.trim}</p>}
                    <p className="mt-1.5 text-xs text-muted-foreground">{Number(car.mileage).toLocaleString()} mi</p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
                    <div className="py-2.5">
                      <p className="text-xs text-muted-foreground">Trade</p>
                      <p className="text-xs font-semibold">{money(car.trade_in)}</p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-xs text-muted-foreground">Private</p>
                      <p className="text-xs font-semibold">{money(car.private_party)}</p>
                    </div>
                    <div className="py-2.5">
                      <p className="text-xs text-muted-foreground">Retail</p>
                      <p className="text-xs font-semibold">{money(car.retail)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2">
                    <Link href={`/appraise?vin=${car.vin}`}>
                      <Button variant="outline" size="sm" className="w-full rounded-md text-xs h-7">Re-appraise</Button>
                    </Link>
                    {car.profile_encoded ? (
                      <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
                        <Button variant="outline" size="sm" className="w-full rounded-md text-xs h-7 gap-1">Report <ExternalLink className="h-2.5 w-2.5" /></Button>
                      </Link>
                    ) : <div />}
                  </div>
                </div>
              ))}
              <Link href="/appraise" className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-border transition-colors hover:border-foreground/20 hover:bg-muted/30">
                <div className="text-center">
                  <Plus className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Add a car</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Recent searches</h2>
              <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {history.map((s, i) => (
                <div key={s.id} className={`flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 ${i > 0 ? "border-t border-border" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.year} {s.make} {s.model}{s.trim ? ` ${s.trim}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{Number(s.mileage).toLocaleString()} mi · {s.condition} · {timeAgo(s.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Trade-in</p>
                      <p className="text-sm font-semibold">{money(s.trade_in)}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Private</p>
                      <p className="text-sm font-semibold">{money(s.private_party)}</p>
                    </div>
                    {s.profile_encoded && (
                      <Link href={`/profile?d=${s.profile_encoded}`} target="_blank">
                        <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1">
                          Report <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {garage.length === 0 && history.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
            <Car className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">You're all set up.</p>
              <p className="mt-1 text-sm text-muted-foreground">Run your first appraisal and your history will appear here.</p>
            </div>
            <Link href="/appraise">
              <Button size="sm" className="rounded-lg gap-2">
                Appraise a car <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
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

  if (status === "authenticated" && garage !== null && history !== null) {
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
                Full appraisal + where to sell <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/value">
              <Button size="lg" variant="outline" className="h-11 rounded-xl px-7 text-sm">
                Quick value check
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Two tools */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Two tools</p>
          </div>
          <div className="mb-10 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Pick the right one for you</h2>
            <p className="text-sm text-muted-foreground hidden sm:block">Both are free. Both take under 2 minutes.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/value">
              <motion.div
                whileHover={{ y: -2 }}
                className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mb-1 text-xs text-muted-foreground">Quick · 30 seconds</p>
                <h3 className="mb-2 text-xl font-semibold">Quick Value Check</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Enter a VIN, add mileage and condition, and see what similar cars are selling for right now.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Live market comps", "Price vs mileage chart", "Adjusted estimate"].map((f) => (
                    <span key={f} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">{f}</span>
                  ))}
                </div>
              </motion.div>
            </Link>
            <Link href="/appraise">
              <motion.div
                whileHover={{ y: -2 }}
                className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mb-1 text-xs text-muted-foreground">Full appraisal · 2 minutes</p>
                <h3 className="mb-2 text-xl font-semibold">Appraise + Where to Sell</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Trade-in, private party, and retail values — plus live estimated offers from Carvana, CarMax, and more.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Trade-in · Private · Retail", "Carvana", "CarMax", "Recalls", "Selling tips"].map((f) => (
                    <span key={f} className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">{f}</span>
                  ))}
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
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
                Get a full appraisal <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/value">
              <Button size="lg" variant="outline" className="h-11 rounded-xl px-7 text-sm">
                Quick value check
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
