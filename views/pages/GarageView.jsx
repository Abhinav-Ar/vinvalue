"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, ArrowUpRight, CarFront, ExternalLink, LayoutGrid, List, Loader2, Plus, Trash2 } from "lucide-react";
import SiteHeader from "@/views/components/SiteHeader";
import VehiclePhoto from "@/views/components/VehiclePhoto";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import Reveal from "@/views/components/Reveal";
import { decodeProfile } from "@/models/profile";

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function CarCard({ car, onRemove, removing }) {
  const profile = car.profile_encoded ? decodeProfile(car.profile_encoded) : null;
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <VehiclePhoto car={car} storedPhoto={profile?.vehiclePhoto} className="vehicle-photo-curated" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{car.year} {car.make} {car.model}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{car.trim || "Standard trim"} · {Number(car.mileage).toLocaleString()} mi</p></div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{car.condition}</span>
        </div>
        <div className="mt-7"><p className="data-label">Instant-sale estimate</p><p className="stat-value mt-2">{money(car.trade_in)}</p></div>
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
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const filteredCars = cars.filter((car) => `${car.year} ${car.make} ${car.model} ${car.trim || ""} ${car.vin}`.toLowerCase().includes(query.toLowerCase().trim()));

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
    <div className="min-h-screen"><SiteHeader /><main id="main-content" className="workspace mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="page-heading flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">The owner’s workspace / Collection</p><h1 className="editorial-title mt-3">My garage.</h1><p className="mt-4 text-sm text-muted-foreground">Your vehicles. Their values. A little perspective, all in one place.</p></div>{status === "authenticated" && <Button asChild className="h-11 px-5"><Link href="/appraise"><Plus /> Add vehicle</Link></Button>}</div>
      {status === "authenticated" && <div className="collection-toolbar"><span aria-live="polite">{loading ? "LOADING COLLECTION" : `${filteredCars.length} OF ${cars.length} VEHICLES`}</span><div className="flex w-full items-center gap-2 sm:w-auto"><Input className="collection-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search make, model, or VIN…" aria-label="Search your garage" /><Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"}><List /></Button><Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"}><LayoutGrid /></Button></div></div>}

      {status === "unauthenticated" && <section className="surface mx-auto mt-14 max-w-xl p-10 text-center"><CarFront className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-5 text-2xl font-semibold">Keep your vehicles in one place</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in to save appraisal snapshots and reopen their reports from any device.</p><Button onClick={() => signIn("google")} className="mt-7 rounded-xl">Sign in with Google</Button></section>}
      {(status === "loading" || (status === "authenticated" && loading)) && <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-muted" />)}</div>}
      {error && <p className="mt-8 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {!loading && status === "authenticated" && cars.length === 0 && <section className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 py-20 text-center"><CarFront className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-5 font-semibold">Your Garage is empty</h2><p className="mt-2 text-sm text-muted-foreground">Run an appraisal, then save the vehicle here.</p><Button asChild className="mt-6 rounded-xl"><Link href="/appraise">Appraise a vehicle <ArrowRight /></Link></Button></section>}
      {!loading && status === "authenticated" && cars.length > 0 && filteredCars.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No vehicles match “{query}”. <button onClick={() => setQuery("")} className="text-primary underline underline-offset-4">Clear search</button></p>}
      {!loading && filteredCars.length > 0 && (view === "grid" ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCars.map((car, index) => <Reveal key={car.id} delay={Math.min(index * 60, 240)}><CarCard car={car} onRemove={remove} removing={removing} /></Reveal>)}
        </div>
      ) : (
        <div className="garage-table-wrap" role="region" aria-label="Saved vehicles" tabIndex={0}>
          <table className="garage-table">
            <thead><tr><th scope="col">Vehicle</th><th scope="col">Mileage</th><th scope="col">Instant sale</th><th scope="col">Condition</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{filteredCars.map((car) => (
              <tr key={car.id}>
                <td><Link href={`/appraise?vin=${car.vin}`} className="garage-vehicle"><VehiclePhoto car={car} interactive={false} /><span><strong>{car.year} {car.make} {car.model}</strong><small>{car.trim || "Standard trim"}</small></span></Link></td>
                <td className="font-mono">{Number(car.mileage).toLocaleString()}<small>miles</small></td>
                <td><strong className="text-primary">{money(car.trade_in)}</strong><small>Estimated value</small></td>
                <td><span className="condition-dot" />{car.condition}</td>
                <td><div className="flex justify-end gap-1">
                  {car.profile_encoded && <Button asChild variant="ghost" size="icon"><Link href={`/profile?d=${car.profile_encoded}`} target="_blank" aria-label={`Open report for ${car.year} ${car.make} ${car.model}`}><ExternalLink /></Link></Button>}
                  <Button asChild variant="ghost" size="icon"><Link href={`/appraise?vin=${car.vin}`} aria-label={`Refresh appraisal for ${car.year} ${car.make} ${car.model}`}><ArrowUpRight /></Link></Button>
                  <Button variant="ghost" size="icon" disabled={removing === car.vin} onClick={() => remove(car.vin)} aria-label={`Remove ${car.year} ${car.make} ${car.model}`} className="hover:text-destructive">{removing === car.vin ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
          <p className="mt-5 text-[10px] text-muted-foreground">A snapshot, not a standing offer. Refresh an appraisal when your mileage or condition changes.</p>
        </div>
      ))}
    </main></div>
  );
}
