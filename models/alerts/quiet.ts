/**
 * Quiet-hours math with Intl only (no tz library). Times are "HH:MM" local
 * wall-clock in an IANA zone; windows may cross midnight (22:00 -> 07:00).
 */
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function localParts(at: Date, tz: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const { type, value } of fmt.formatToParts(at)) if (type !== 'literal') p[type] = Number(value);
  return { y: p.year!, mo: p.month!, d: p.day!, h: p.hour! % 24, mi: p.minute!, s: p.second! };
}

/** Offset of tz from UTC at instant `at`, in ms (local - utc). */
function offsetMs(at: Date, tz: string): number {
  const p = localParts(at, tz);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant for a local wall time in tz (re-checks the offset once for DST edges). */
export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess), tz);
  const o2 = offsetMs(new Date(t), tz);
  t = guess - o2;
  return new Date(t);
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * If `now` falls inside the quiet window, the UTC instant the window ends;
 * otherwise null (deliver now). start === end or missing means no quiet hours.
 */
export function quietWindowEnd(now: Date, tz: string, start: string | null, end: string | null): Date | null {
  if (!start || !end || start === end || !HHMM_RE.test(start) || !HHMM_RE.test(end)) return null;
  const zone = isValidTimeZone(tz) ? tz : 'UTC';
  const p = localParts(now, zone);
  const m = p.h * 60 + p.mi;
  const s = toMin(start);
  const e = toMin(end);
  let inside: boolean;
  let endIsTomorrow = false;
  if (s < e) {
    inside = m >= s && m < e;
  } else {
    inside = m >= s || m < e;
    endIsTomorrow = m >= s;
  }
  if (!inside) return null;
  // Local calendar date of the window end (roll the day via UTC arithmetic on the date only).
  const base = new Date(Date.UTC(p.y, p.mo - 1, p.d + (endIsTomorrow ? 1 : 0)));
  return zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), Math.floor(e / 60), e % 60, zone);
}
