"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Clock, ExternalLink, Car, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";

function money(v) {
  if (!Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function Nav() {
  return <SiteHeader />;
}

export default function HistoryPage() {
  const { status } = useSession();
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setSearches(d.searches ?? []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Reports</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Appraisal history</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Every appraisal you&apos;ve run, saved automatically.</p>
          </div>
          <Link href="/appraise">
            <Button size="sm" className="rounded-lg gap-2">
              New appraisal <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        )}

        {!loading && searches.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card py-16 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="font-semibold">No searches yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Run an appraisal and it&apos;ll appear here automatically.</p>
            </div>
            <Link href="/appraise">
              <Button size="sm" className="rounded-lg">
                Run your first appraisal
              </Button>
            </Link>
          </div>
        )}

        {!loading && searches.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            {searches.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {s.year} {s.make} {s.model}
                      {s.trim ? <span className="ml-1.5 font-normal text-muted-foreground">{s.trim}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(s.mileage).toLocaleString()} mi · {s.condition} · {timeAgo(s.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-5">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">Trade-in</p>
                    <p className="text-sm font-semibold">{money(s.trade_in)}</p>
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-xs text-muted-foreground">Private</p>
                    <p className="text-sm font-semibold">{money(s.private_party)}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">Retail</p>
                    <p className="text-sm font-semibold">{money(s.retail)}</p>
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
        )}
      </main>
    </div>
  );
}
