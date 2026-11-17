'use client';
/** Garage helpers shared by /garage, /garage/maintenance and /garage/[vehicleId]. */
import Link from 'next/link';
import type { CarVariant } from '@/components/CarDrawing';
import { ApiError, type FieldErrors } from '@/lib/client/api';

/* ------------------------------------------------------------------ types */

export type Badge = { letter: string; label: string; short: string; index: number };
export type NextService = { title: string; date: string; statusText: string; overdue: boolean } | null;

export type GarageVehicle = {
  id: string; label: string; nickname: string | null; odometer: number; zip: string; flags: string[];
  privateValue: number | null; lastAppraisedAt: string | null;
  change: { amount: number; sinceDate: string } | null;
  nextService: NextService;
};
export type GarageResponse = { vehicles: GarageVehicle[]; totals: { vehicles: number; totalPrivateValue: number; dueIn30Days: number } };

export type UpcomingDateItem = {
  kind: 'date'; source: 'event' | 'interval'; eventId: string | null; vehicleId: string; vehicle?: Badge;
  type: string; title: string; date: string; daysUntil: number; overdue: boolean; statusText: string;
};
export type UpcomingMileageItem = {
  kind: 'mileage'; source: 'interval'; eventId: null; vehicleId: string; vehicle?: Badge;
  type: string; title: string; currentMiles: number; dueAtMiles: number; milesLeft: number; overdue: boolean;
  projectedDate: string | null; statusText: string;
};
export type UpcomingResponse = {
  today: string;
  items: (UpcomingDateItem | UpcomingMileageItem)[];
  dueNext: UpcomingDateItem[];
  byMileage: UpcomingMileageItem[];
};

/* ---------------------------------------------------------------- badges */

/** `.bdg .b1` filled, `.b2` outline, `.b3` dotted. A fourth car repeats the first style. */
export const badgeClass = (index: number) => `bdg b${(index % 3) + 1}`;

/* ---------------------------------------------------------------- drawing */

const MUSCLE = /\b(mustang|camaro|challenger|charger|corvette|firebird|trans am|gto|chevelle)\b/i;
const ROADSTER = /\b(mx-5|miata|roadster|spider|spyder|boxster|z4|s2000|convertible|cabriolet)\b/i;

/** Pick the CarDrawing variant from the model name and body style. */
export function carVariant(label: string, body?: string | null): CarVariant {
  const s = `${label} ${body ?? ''}`;
  if (ROADSTER.test(s)) return 'roadster';
  if (MUSCLE.test(s)) return 'muscle';
  return 'gt';
}

/* ------------------------------------------------------------------ dates */

/** Today as YYYY-MM-DD in the browser; only a fallback until the server's `today` arrives. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ymd(y: number, m0: number, d: number): string {
  return new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y!, m! - 1, d!); };
  return Math.round((p(b) - p(a)) / 86_400_000);
}

/** "in 6 days" | "today" | "3 days overdue" (same wording as the backend). */
export function statusText(date: string, today: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return 'today';
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`;
  return `${-n} day${n === -1 ? '' : 's'} overdue`;
}

/* -------------------------------------------------------------- flags */

const FLAG_TEXT: Record<string, string> = {
  mileage_high_for_age: 'Mileage is high for the model year',
};
export const flagText = (f: string) => FLAG_TEXT[f] ?? f.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/* -------------------------------------------------------------- uploads */

/** multipart POST (api() always JSON-encodes), with the same ApiError shape. */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', body: form, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'network', 'You appear to be offline. Check your connection and try again.');
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const e = (data as { error?: Record<string, unknown> } | null)?.error ?? {};
    const { code, message, fields, ...details } = e as { code?: string; message?: string; fields?: FieldErrors };
    throw new ApiError(res.status, code ?? 'internal', message ?? 'Something went wrong on our side. Try again.', fields ?? {}, details);
  }
  return data as T;
}

export const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, 'internal', String(e)));

/* ---------------------------------------------------------------- tabs */

export function GarageTabs({ on }: { on: 'vehicles' | 'maintenance' }) {
  return (
    <nav className="stepper" aria-label="Garage sections" style={{ gap: 32, marginTop: 28 }}>
      <Link href="/garage" className={on === 'vehicles' ? 'on' : ''} style={{ flex: '0 0 auto' }} aria-current={on === 'vehicles' ? 'page' : undefined}>Vehicles</Link>
      <Link href="/garage/maintenance" className={on === 'maintenance' ? 'on' : ''} style={{ flex: '0 0 auto' }} aria-current={on === 'maintenance' ? 'page' : undefined}>Maintenance + calendar</Link>
    </nav>
  );
}

/** Overview / Value tracker / Sell or trade / Maintenance. The tools agent can reuse this on value and sell. */
export function VehicleTabs({ id, on }: { id: string; on: 'overview' | 'value' | 'sell' }) {
  const tabs = [
    { key: 'overview', label: 'Overview', href: `/garage/${id}` },
    { key: 'value', label: 'Value tracker', href: `/garage/${id}/value` },
    { key: 'sell', label: 'Sell or trade', href: `/garage/${id}/sell` },
    { key: 'maintenance', label: 'Maintenance', href: `/garage/maintenance?vehicle=${id}` },
  ];
  return (
    <nav className="stepper" aria-label="Vehicle sections" style={{ gap: 32, marginTop: 24 }}>
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === on ? 'on' : ''} style={{ flex: '0 0 auto' }} aria-current={t.key === on ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
