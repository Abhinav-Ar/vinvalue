/**
 * Date math on `YYYY-MM-DD` strings only (UTC-based so no DST or local-zone drift),
 * plus the user-visible status wording shared by garage, maintenance and alerts.
 */
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return [y, m, day];
}

export function toUtcMs(d: string): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
}

export function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** b - a in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

export function addDays(d: string, n: number): string {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS);
}

/** Adds calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = parts(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(ny, nm, Math.min(day, last)));
}

/** "Nov 18" */
export function fmtShort(d: string): string {
  const [, m, day] = parts(d);
  return `${MONTHS[m - 1]} ${day}`;
}

/** "Dec 22, 2026" */
export function fmtLong(d: string): string {
  const [y] = parts(d);
  return `${fmtShort(d)}, ${y}`;
}

/** "May 2027" */
export function fmtMonthYear(d: string): string {
  const [y, m] = parts(d);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Status wording from the design: "in 6 days", "today", "3 days overdue". */
export function statusText(date: string, today: string): string {
  const n = diffDays(today, date);
  if (n === 0) return 'today';
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`;
  return `${-n} day${n === -1 ? '' : 's'} overdue`;
}

/** Calendar date for an instant in an IANA time zone. */
export function dateInZone(now: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
