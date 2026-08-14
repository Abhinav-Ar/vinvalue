"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, Clock3, ExternalLink, FileText } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

function money(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0); }
function date(value) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }

export default function ActivityPage() {
  const { status } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/history").then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setItems(data.searches || []); }).catch((err) => setError(err.message || "Could not load activity.")).finally(() => setLoading(false));
  }, [status]);

  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Activity</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Appraisal history</h1><p className="mt-2 text-sm text-muted-foreground">Your latest estimate for each VIN, kept for quick reference.</p></div>{status === "authenticated" && <Button asChild className="rounded-xl"><Link href="/appraise">New appraisal <ArrowRight /></Link></Button>}</div>
    {status === "unauthenticated" && <section className="surface mx-auto mt-14 max-w-xl p-10 text-center"><Clock3 className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-5 text-2xl font-semibold">Your reports, when you need them</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Sign in to retain appraisal history and reopen the evidence behind each estimate.</p><Button onClick={() => signIn("google")} className="mt-7 rounded-xl">Sign in with Google</Button></section>}
    {(status === "loading" || (status === "authenticated" && loading)) && <div className="mt-10 space-y-3">{[1,2,3].map((item) => <div className="h-24 animate-pulse rounded-2xl bg-muted" key={item} />)}</div>}
    {error && <p className="mt-8 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
    {!loading && status === "authenticated" && items.length === 0 && <section className="mt-10 rounded-3xl border border-dashed border-border bg-card/60 py-20 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><h2 className="mt-5 font-semibold">No appraisal history</h2><p className="mt-2 text-sm text-muted-foreground">Completed appraisals will appear here.</p><Button asChild className="mt-6 rounded-xl"><Link href="/appraise">Start an appraisal</Link></Button></section>}
    {!loading && items.length > 0 && <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card">{items.map((item, index) => <article key={item.activity_id || `${item.source}-${item.id}`} className={`grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6 ${index ? "border-t border-border" : ""}`}><div className="min-w-0"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><FileText className="h-4 w-4" /></span><div className="min-w-0"><h2 className="truncate font-semibold">{item.year} {item.make} {item.model}{item.trim ? ` ${item.trim}` : ""}</h2><p className="mt-1 text-xs text-muted-foreground">{Number(item.mileage).toLocaleString()} mi · {item.condition} · {date(item.created_at)}{item.source === "garage" ? " · Imported from Garage" : ""}</p></div></div></div><div className="flex items-center justify-between gap-6 sm:justify-end"><div><p className="data-label">Instant sale</p><p className="mt-1 text-xl font-semibold">{money(item.trade_in)}</p></div>{item.profile_encoded && <Button asChild variant="outline" className="rounded-xl"><Link href={`/profile?d=${item.profile_encoded}`} target="_blank">Report <ExternalLink /></Link></Button>}</div></article>)}</div>}
  </main></div>;
}
