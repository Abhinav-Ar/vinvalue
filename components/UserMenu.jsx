"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { LogIn, LogOut, Car, Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (status === "loading") {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => signIn("google")}
        className="gap-2 rounded-xl"
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-indigo-700"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            className="h-6 w-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {session.user.name?.[0] ?? "?"}
          </div>
        )}
        <span className="hidden max-w-[120px] truncate sm:block">{session.user.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{session.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/garage"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <Car className="h-4 w-4 text-indigo-400" />
              My Garage
            </Link>
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <Clock className="h-4 w-4 text-indigo-400" />
              Search History
            </Link>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
