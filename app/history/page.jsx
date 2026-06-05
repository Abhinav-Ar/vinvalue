"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap, Clock, ExternalLink, Car, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserMenu from "@/components/UserMenu";

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

export default function HistoryPage() {
  const { data: session, status } = useSession();
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
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight transition-colors group-hover:text-indigo-400">AutoIQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <Badge className="rounded-full border-indigo-800/50 bg-indigo-950/50 text-indigo-400">
              Search History
            </Badge>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-500">Your account</p>
            <h1 className="text-4xl font-bold tracking-tight">Search History</h1>
            <p className="mt-2 text-muted-foreground">Every appraisal you've run, saved automatically.</p>
          </div>
          <Link href="/appraise">
            <Button className="rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
              New appraisal <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        )}

        {!loading && searches.length === 0 && (
          <Card className="rounded-3xl border-border">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-lg font-semibold">No searches yet</p>
              <p className="text-muted-foreground">Run an appraisal and it'll appear here automatically.</p>
              <Link href="/appraise">
                <Button className="mt-2 rounded-xl border-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                  Run your first appraisal
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && searches.length > 0 && (
          <div className="space-y-3">
            {searches.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-indigo-800/60"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-950/80 ring-1 ring-indigo-800/40">
                    <Car className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {s.year} {s.make} {s.model}
                      {s.trim ? <span className="ml-2 text-sm font-normal text-muted-foreground">{s.trim}</span> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Number(s.mileage).toLocaleString()} mi · {s.condition} · {timeAgo(s.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-6">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">Trade-in</p>
                    <p className="font-bold text-amber-400">{money(s.trade_in)}</p>
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-xs text-muted-foreground">Private</p>
                    <p className="font-bold text-indigo-400">{money(s.private_party)}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-muted-foreground">Retail</p>
                    <p className="font-bold text-emerald-400">{money(s.retail)}</p>
                  </div>
                  {s.profile_encoded && (
                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                      <Link href={`/profile?d=${s.profile_encoded}`} target="_blank">
                        Report <ExternalLink className="ml-1.5 h-3 w-3" />
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
