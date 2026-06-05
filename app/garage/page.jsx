"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap, Car, Trash2, ExternalLink, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/UserMenu";

function money(v) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

export default function GaragePage() {
  const { data: session, status } = useSession();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/garage")
      .then((r) => r.json())
      .then((d) => setCars(d.cars ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  async function remove(vin) {
    setRemoving(vin);
    await fetch("/api/garage", { method: "DELETE", body: JSON.stringify({ vin }), headers: { "Content-Type": "application/json" } });
    setCars((prev) => prev.filter((c) => c.vin !== vin));
    setRemoving(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight transition-colors group-hover:text-indigo-400">AutoIQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400">My Garage</Badge>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-500">Your account</p>
            <h1 className="text-4xl font-bold tracking-tight">My Garage</h1>
            <p className="mt-2 text-muted-foreground">Cars you've saved. Click any to view the full seller's report.</p>
          </div>
          <Link href="/appraise">
            <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add a car
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-card" />
            ))}
          </div>
        )}

        {!loading && cars.length === 0 && (
          <Card className="rounded-3xl border-border">
            <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
              <Car className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-lg font-semibold">Your garage is empty</p>
              <p className="text-muted-foreground">Run an appraisal and save any car to your garage to track it here.</p>
              <Link href="/appraise">
                <Button className="mt-2 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  Appraise a car <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && cars.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car) => (
              <Card key={car.id} className="overflow-hidden rounded-3xl border-border">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-indigo-950/60 to-violet-950/60 p-5">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-bold">
                          {car.year} {car.make} {car.model}
                        </p>
                        {car.trim && <p className="truncate text-sm text-muted-foreground">{car.trim}</p>}
                        {car.nickname && (
                          <Badge className="mt-1 rounded-full border-violet-800/50 bg-violet-950/50 text-violet-400 text-xs">
                            {car.nickname}
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={() => remove(car.vin)}
                        disabled={removing === car.vin}
                        className="shrink-0 rounded-xl p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-950/40 hover:text-red-400"
                        title="Remove from garage"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {car.vin} · {Number(car.mileage).toLocaleString()} mi · {car.condition}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                    {[
                      { label: "Trade-in", value: car.trade_in, color: "text-amber-400" },
                      { label: "Private", value: car.private_party, color: "text-indigo-400" },
                      { label: "Retail", value: car.retail, color: "text-emerald-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="px-3 py-3 text-center">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-sm font-bold ${color}`}>{money(value)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <Link href={`/appraise?vin=${car.vin}`}>
                        Re-appraise
                      </Link>
                    </Button>
                    {car.profile_encoded && (
                      <Button variant="outline" size="sm" className="rounded-xl" asChild>
                        <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
                          Report <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
