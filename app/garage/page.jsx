"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap, Car, Trash2, ExternalLink, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";

function money(v) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <Zap className="h-3.5 w-3.5 text-background" />
          </div>
          <span className="text-sm font-semibold">AutoIQ</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <Link href="/value" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Value</Link>
          <Link href="/appraise" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Appraise</Link>
          <Link href="/garage" className="rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">Garage</Link>
        </nav>
        <UserMenu />
      </div>
    </header>
  );
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
      <Nav />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Garage</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">My cars</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Cars you've saved and their latest valuations.</p>
          </div>
          <Link href="/appraise">
            <Button size="sm" className="rounded-lg gap-2">
              <Plus className="h-3.5 w-3.5" /> Add car
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        )}

        {!loading && cars.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
            <Car className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">Your garage is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Run an appraisal and save a car to track it here.</p>
            </div>
            <Link href="/appraise">
              <Button size="sm" className="rounded-lg gap-2">
                Appraise a car <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {!loading && cars.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car) => (
              <div key={car.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 p-5 pb-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {car.year} {car.make} {car.model}
                    </p>
                    {car.trim && <p className="mt-0.5 truncate text-xs text-muted-foreground">{car.trim}</p>}
                    {car.nickname && (
                      <p className="mt-1 text-xs text-muted-foreground">"{car.nickname}"</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Number(car.mileage).toLocaleString()} mi · {car.condition}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(car.vin)}
                    disabled={removing === car.vin}
                    className="shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-muted-foreground"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Values */}
                <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                  {[
                    { label: "Trade", value: car.trade_in },
                    { label: "Private", value: car.private_party },
                    { label: "Retail", value: car.retail },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-3 text-center">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-sm font-semibold">{money(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
                  <Link href={`/appraise?vin=${car.vin}`}>
                    <Button variant="outline" size="sm" className="w-full rounded-lg text-xs">
                      Re-appraise
                    </Button>
                  </Link>
                  {car.profile_encoded ? (
                    <Link href={`/profile?d=${car.profile_encoded}`} target="_blank">
                      <Button variant="outline" size="sm" className="w-full rounded-lg text-xs gap-1">
                        Report <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
