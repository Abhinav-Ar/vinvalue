"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Search, BarChart3, Car, ArrowRight, DollarSign, Clock, Plus, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

function Dashboard({ session, garage, history }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">AutoIQ</span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">{greeting}, {firstName}.</h1>
          <p className="mt-2 text-lg text-muted-foreground">Here's your AutoIQ dashboard.</p>
        </div>

        {/* Quick actions */}
        <div className="mb-10 flex flex-wrap gap-3">
          <Link href="/appraise">
            <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/30">
              <Plus className="mr-2 h-4 w-4" /> New appraisal
            </Button>
          </Link>
          <Link href="/garage">
            <Button variant="outline" className="rounded-xl gap-2">
              <Car className="h-4 w-4" /> My Garage
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="outline" className="rounded-xl gap-2">
              <Clock className="h-4 w-4" /> Search History
            </Button>
          </Link>
        </div>

        {/* Garage */}
        {garage.length > 0 && (
          <div className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">My Garage</h2>
              <Link href="/garage" className="text-sm text-indigo-400 hover:underline">View all</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {garage.slice(0, 4).map((car) => (
                <Card key={car.id} className="overflow-hidden rounded-3xl border-border">
                  <div className="bg-gradient-to-br from-indigo-950/60 to-violet-950/60 p-4">
                    <p className="truncate font-bold">{car.year} {car.make} {car.model}</p>
                    {car.trim && <p className="truncate text-xs text-muted-foreground">{car.trim}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{Number(car.mileage).toLocaleString()} mi</p>
                  </div>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center text-xs">
                      <div className="py-2.5"><p className="text-muted-foreground">Trade</p><p className="font-bold text-amber-400">{money(car.trade_in)}</p></div>
                      <div className="py-2.5"><p className="text-muted-foreground">Private</p><p className="font-bold text-indigo-400">{money(car.private_party)}</p></div>
                      <div className="py-2.5"><p className="text-muted-foreground">Retail</p><p className="font-bold text-emerald-400">{money(car.retail)}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2">
                      <Link href={`/appraise?vin=${car.vin}`}>
                        <Button variant="outline" size="sm" className="w-full rounded-xl text-xs">Re-appraise</Button>
                      </Link>
                      {car.profile_encoded && (
                        <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
                          <Button variant="outline" size="sm" className="w-full rounded-xl text-xs gap-1">Report <ExternalLink className="h-3 w-3" /></Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Link href="/appraise" className="flex items-center justify-center rounded-3xl border border-dashed border-border bg-card p-6 text-center transition-colors hover:border-indigo-700 min-h-[180px]">
                <div>
                  <Plus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Add a car</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Recent history */}
        {history.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Searches</h2>
              <Link href="/history" className="text-sm text-indigo-400 hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {history.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-indigo-800/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <Car className="h-4 w-4 shrink-0 text-indigo-400" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm">{s.year} {s.make} {s.model}{s.trim ? ` ${s.trim}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{Number(s.mileage).toLocaleString()} mi · {s.condition} · {timeAgo(s.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Trade-in</p>
                      <p className="text-sm font-bold text-amber-400">{money(s.trade_in)}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-muted-foreground">Private</p>
                      <p className="text-sm font-bold text-indigo-400">{money(s.private_party)}</p>
                    </div>
                    {s.profile_encoded && (
                      <Link href={`/profile?d=${s.profile_encoded}`} target="_blank">
                        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1">
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
          <Card className="rounded-3xl border-border">
            <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
              <Car className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-xl font-bold">You're all set up.</p>
              <p className="text-muted-foreground">Run your first appraisal and your history and garage will appear here.</p>
              <Link href="/appraise">
                <Button className="mt-2 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  Appraise a car <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

const STEPS = [
  {
    icon: Search,
    step: "01",
    title: "Decode your VIN",
    desc: "Enter your 17-character VIN and we instantly pull the exact make, model, trim, engine, and drivetrain from the NHTSA database.",
  },
  {
    icon: Car,
    step: "02",
    title: "Add your details",
    desc: "Tell us your mileage, ZIP code, condition, title status, and accident history so we can tailor the valuation to your specific car.",
  },
  {
    icon: BarChart3,
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

  // Show dashboard for signed-in users once their data loads
  if (status === "authenticated" && garage !== null && history !== null) {
    return <Dashboard session={session} garage={garage} history={history} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">AutoIQ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/value">
              <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/30 hover:from-indigo-700 hover:to-violet-700">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/25 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-4xl text-center"
        >
          <Badge className="mb-8 rounded-full border-indigo-800/60 bg-indigo-950/60 px-4 py-1.5 text-indigo-400">
            Live market data · No account needed · Free
          </Badge>

          <h1 className="text-6xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Stop guessing.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Start knowing.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-muted-foreground">
            Enter a VIN and get a real-time valuation based on live market
            listings, adjusted for your car's exact condition, mileage, and
            history.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/appraise">
              <Button
                size="lg"
                className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-10 text-base text-white shadow-xl shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
              >
                Full Appraisal + Where to Sell <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/value">
              <Button
                size="lg"
                variant="outline"
                className="h-14 rounded-2xl border-border px-10 text-base hover:border-indigo-700 hover:text-indigo-400"
              >
                Quick Value Check
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted-foreground/60">
            Free · No signup required · Results in seconds
          </p>
        </motion.div>
      </section>

      {/* Two tools */}
      <section className="border-t border-border/50 px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">Two tools</p>
            <h2 className="text-4xl font-bold tracking-tight">Pick the right one for you</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/value">
              <motion.div
                whileHover={{ y: -4 }}
                className="group cursor-pointer rounded-3xl border border-border bg-card p-8 transition-colors hover:border-indigo-800/60"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950/80 ring-1 ring-indigo-800/40">
                  <Search className="h-6 w-6 text-indigo-400" />
                </div>
                <Badge className="mb-3 rounded-full border-indigo-800/50 bg-indigo-950/60 text-indigo-400">Quick · 30 seconds</Badge>
                <h3 className="mb-2 text-2xl font-bold transition-colors group-hover:text-indigo-400">Quick Value Check</h3>
                <p className="mb-5 leading-relaxed text-muted-foreground">
                  Enter a VIN, add mileage and condition, and instantly see what similar cars are selling for on the market.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Live market comps", "Price vs mileage chart", "Adjusted estimate"].map((f) => (
                    <span key={f} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{f}</span>
                  ))}
                </div>
              </motion.div>
            </Link>
            <Link href="/appraise">
              <motion.div
                whileHover={{ y: -4 }}
                className="group cursor-pointer rounded-3xl border border-border bg-card p-8 transition-colors hover:border-violet-800/60"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-950/80 ring-1 ring-violet-800/40">
                  <DollarSign className="h-6 w-6 text-violet-400" />
                </div>
                <Badge className="mb-3 rounded-full border-violet-800/50 bg-violet-950/60 text-violet-400">Full appraisal · 2 minutes</Badge>
                <h3 className="mb-2 text-2xl font-bold transition-colors group-hover:text-violet-400">Appraise + Where to Sell</h3>
                <p className="mb-5 leading-relaxed text-muted-foreground">
                  Get your trade-in, private party, and retail values — then compare live estimated offers from Carvana, CarMax, Vroom, and more.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Trade-in · Private · Retail", "Carvana", "CarMax", "Vroom", "Recalls + safety", "Selling tips"].map((f) => (
                    <span key={f} className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">{f}</span>
                  ))}
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
              How it works
            </p>
            <h2 className="text-4xl font-bold tracking-tight">
              Three steps to a fair price
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, step, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-3xl border border-border bg-card p-8"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950/80 ring-1 ring-indigo-800/40">
                    <Icon className="h-6 w-6 text-indigo-400" />
                  </div>
                  <span className="text-5xl font-bold text-muted/30">{step}</span>
                </div>
                <h3 className="mb-3 text-xl font-bold">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50 px-6 py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-5xl font-bold tracking-tight">
            Know your car's value.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Then sell it smarter.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            No account. No subscription. Just your VIN and the truth.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/appraise">
              <Button
                size="lg"
                className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-10 text-base text-white shadow-xl shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
              >
                Full Appraisal + Where to Sell <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/value">
              <Button size="lg" variant="outline" className="h-14 rounded-2xl border-border px-10 text-base hover:border-indigo-700 hover:text-indigo-400">
                Quick Value Check
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-sm text-muted-foreground/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-muted-foreground">AutoIQ</span>
          </div>
          <p>VIN data via NHTSA · Listings via MarketCheck</p>
        </div>
      </footer>
    </div>
  );
}
