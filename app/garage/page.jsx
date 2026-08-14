"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, CarFront, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VehiclePhoto from "@/components/VehiclePhoto";
import { Button } from "@/components/ui/button";
import { decodeProfile } from "@/lib/profileEncoding";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function CarCard({ car, onRemove, removing }) {
  const profile = car.profile_encoded ? decodeProfile(car.profile_encoded) : null;
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <VehiclePhoto car={car} storedPhoto={profile?.vehiclePhoto} className="vehicle-photo-curated" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{car.year} {car.make} {car.model}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{car.trim || "Standard trim"} · {Number(car.mileage).toLocaleString()} mi</p></div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{car.condition}</span>
        </div>
        <div className="mt-7"><p className="data-label">Instant-sale estimate</p><p className="mt-2 text-4xl font-semibold tracking-[-.04em]">{money(car.trade_in)}</p></div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 text-sm"><div><p className="text-xs text-muted-foreground">Private sale</p><p className="mt-1 font-semibold">{money(car.private_party)}</p></div><div><p className="text-xs text-muted-foreground">Dealer retail</p><p className="mt-1 font-semibold">{money(car.retail)}</p></div></div>
        <div className="mt-6 flex gap-2">
          <Button asChild className="flex-1 rounded-xl"><Link href={`/appraise?vin=${car.vin}`}>Refresh value <ArrowRight /></Link></Button>
          {car.profile_encoded && <Button variant="outline" size="icon" className="rounded-xl" asChild><Link href={`/profile?d=${car.profile_encoded}`} target="_blank" aria-label="Open report"><ExternalLink /></Link></Button>}
          <Button onClick={() => onRemove(car.vin)} disabled={removing === car.vin} variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-destructive" aria-label="Remove vehicle">{removing === car.vin ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>
        </div>
      </div>
    </article>
  );
}

export default function GaragePage() {
  const { status } = useSession();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/garage").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCars(data.cars || []);
    }).catch((err) => setError(err.message || "Could not load Garage.")).finally(() => setLoading(false));
  }, [status]);

  async function remove(vin) {
    setRemoving(vin); setError("");
    try {
      const response = await fetch("/api/garage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vin }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setCars((current) => current.filter((car) => car.vin !== vin));
    } catch (err) { setError(err.message || "Could not remove vehicle."); }
    finally { setRemoving(null); }
  }

  return (
    <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Garage</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Saved vehicles</h1><p className="mt-2 text-sm text-muted-foreground">One current snapshot per vehicle. Refresh whenever mileage or condition changes.</p></div>{status === "authenticated" && <Button asChild className="rounded-xl"><Link href="/appraise"><Plus /> Add vehicle</Link></Button>}</div>

      {status === "unauthenticated" && <section className="surface mx-auto mt-14 max-w-xl p-10 text-center"><CarFront className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-5 text-2xl font-semibold">Keep your vehicles in one place</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in to save appraisal snapshots and reopen their reports from any device.</p><Button onClick={() => signIn("google")} className="mt-7 rounded-xl">Sign in with Google</Button></section>}
      {(status === "loading" || (status === "authenticated" && loading)) && <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-muted" />)}</div>}
      {error && <p className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!loading && status === "authenticated" && cars.length === 0 && <section className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 py-20 text-center"><CarFront className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-5 font-semibold">Your Garage is empty</h2><p className="mt-2 text-sm text-muted-foreground">Run an appraisal, then save the vehicle here.</p><Button asChild className="mt-6 rounded-xl"><Link href="/appraise">Appraise a vehicle <ArrowRight /></Link></Button></section>}
      {!loading && cars.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{cars.map((car) => <CarCard key={car.id} car={car} onRemove={remove} removing={removing} />)}</div>}
    </main></div>
  );
}
