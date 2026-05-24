"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Search, BarChart3, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
          <Link href="/value">
            <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-900/30 hover:from-indigo-700 hover:to-violet-700">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
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
            <Link href="/value">
              <Button
                size="lg"
                className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-10 text-base text-white shadow-xl shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
              >
                Value My Car <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted-foreground/60">
            Free · No signup required · Results in seconds
          </p>
        </motion.div>
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
            Ready to find out what
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              your car is really worth?
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            No account. No subscription. Just your VIN and the truth.
          </p>
          <div className="mt-10">
            <Link href="/value">
              <Button
                size="lg"
                className="h-14 rounded-2xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 px-10 text-base text-white shadow-xl shadow-indigo-900/40 hover:from-indigo-700 hover:to-violet-700"
              >
                Get My Valuation <ArrowRight className="ml-2 h-5 w-5" />
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
