/**
 * Value history (your appraisals) plus the 12-month forecast band. Port of the chart in design/Value.
 * Date-based x scale: history is daily, the forecast is monthly (plotted mid-month).
 */
import { usd } from '@/lib/client/format';
import { AXIS_TEXT, ChartEmpty, SrTable, kUsd, monthLabel, monthShort, niceDomain } from './shared';

export type ValuePoint = { date: string; value: number };
export type ForecastPoint = { month: string; mid: number; low: number; high: number };

const W = 960;
const H = 345;
const L = 50;
const R = 930;
const T = 20;
const B = 300;
const DAY = 86_400_000;

const t = (iso: string) => Date.parse(iso.slice(0, 10) + 'T12:00:00Z');
const tMonth = (ym: string) => Date.parse(`${ym}-15T12:00:00Z`);
const ymOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

/** Keep the last value for each date (the API can return several appraisals on one day). */
export function dedupeByDate(points: ValuePoint[]) {
  const m = new Map<string, number>();
  for (const p of points) m.set(p.date.slice(0, 10), p.value);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

export function ValueChart({ history: rawHistory, forecast, today, best, alert }: {
  history: ValuePoint[];
  forecast: ForecastPoint[];
  today: ValuePoint;
  best?: { month: string; value: number } | null;
  /** Price alert threshold, drawn as a horizontal line. */
  alert?: number | null;
}) {
  const history = dedupeByDate(rawHistory);
  if (!history.length && !forecast.length) {
    return <ChartEmpty height={H * 0.6}>No appraisals or forecast yet. Appraise this car to start its value history.</ChartEmpty>;
  }

  const todayT = t(today.date);
  const firstT = history.length ? Math.min(t(history[0]!.date), todayT) : todayT;
  const lastT = forecast.length ? tMonth(forecast[forecast.length - 1]!.month) : todayT;
  const x0 = Math.min(firstT, todayT - 30 * DAY);
  const x1 = Math.max(lastT, todayT + 30 * DAY);
  const X = (ms: number) => L + ((ms - x0) / (x1 - x0)) * (R - L);

  const vals = [today.value, ...history.map((p) => p.value), ...forecast.flatMap((f) => [f.low, f.high])];
  if (alert != null && alert > 0) vals.push(alert);
  const dom = niceDomain(Math.min(...vals), Math.max(...vals));
  const Y = (v: number) => T + ((dom.hi - v) / (dom.hi - dom.lo)) * (B - T);
  const pt = (ms: number, v: number) => `${X(ms).toFixed(1)} ${Y(v).toFixed(1)}`;

  // Month ticks at the 1st of each month; thin to every other month when crowded.
  const ticks: number[] = [];
  const d = new Date(x0);
  let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  while (cur <= x1) {
    ticks.push(cur);
    const c = new Date(cur);
    cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
  }
  const every = ticks.length > 14 ? 2 : 1;

  const hpath = history.map((p, i) => (i ? 'L' : 'M') + pt(t(p.date), p.value)).join(' ');
  const start = pt(todayT, today.value);
  const fpath = forecast.length ? `M${start} ` + forecast.map((f) => 'L' + pt(tMonth(f.month), f.mid)).join(' ') : '';
  const band = forecast.length
    ? `M${start} ` +
      forecast.map((f) => 'L' + pt(tMonth(f.month), f.high)).join(' ') +
      ' ' +
      [...forecast].reverse().map((f) => 'L' + pt(tMonth(f.month), f.low)).join(' ') +
      ' Z'
    : '';

  const bestX = best ? X(tMonth(best.month)) : null;
  const todayX = X(todayT);
  const last = forecast[forecast.length - 1];

  const summary =
    `Value history from ${history.length ? monthLabel(history[0]!.date.slice(0, 7)) : 'today'}: ` +
    `${history.length} appraisal${history.length === 1 ? '' : 's'}, today ${usd(today.value)}.` +
    (last ? ` Forecast midpoint ${usd(last.mid)} by ${monthLabel(last.month)}, likely range ${usd(last.low)} to ${usd(last.high)}.` : '') +
    (best ? ` Best time to sell: ${monthLabel(best.month)}, about ${usd(best.value)}.` : '') +
    (alert ? ` Your alert is set at ${usd(alert)}.` : '');

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ display: 'block' }}>
        {dom.ticks.map((v) => (
          <g key={v}>
            <path d={`M${L} ${Y(v).toFixed(1)} L${R} ${Y(v).toFixed(1)}`} stroke="var(--line)" />
            <text x={42} y={Y(v) + 4} textAnchor="end" {...AXIS_TEXT}>{kUsd(v)}</text>
          </g>
        ))}
        {ticks.map((ms, i) =>
          i % every === 0 ? (
            <text key={ms} x={X(ms)} y={330} textAnchor="middle" {...AXIS_TEXT}>{monthShort(ymOf(ms))}</text>
          ) : null,
        )}
        <path d={`M${todayX.toFixed(1)} ${T} L${todayX.toFixed(1)} ${B}`} stroke="var(--ink)" strokeDasharray="4 4" />
        <text x={todayX + 8} y={34} fontSize={12} fill="var(--mid)">Today</text>
        {bestX != null && (
          <>
            <rect x={bestX - 20} y={T} width={40} height={B - T} fill="var(--soft)" />
            <text x={bestX} y={294} textAnchor="middle" fontSize={12} fill="var(--blue)">Best time to sell</text>
          </>
        )}
        {band && <path d={band} fill="var(--soft)" stroke="none" />}
        {history.length > 1 && <path d={hpath} fill="none" stroke="var(--ink)" strokeWidth={2.2} />}
        {history.map((p) => (
          <circle key={p.date} cx={X(t(p.date))} cy={Y(p.value)} r={history.length > 1 ? 2.5 : 4} fill="var(--ink)" />
        ))}
        {fpath && <path d={fpath} fill="none" stroke="var(--blue)" strokeWidth={2} strokeDasharray="7 5" />}
        {alert != null && alert > 0 && (
          <>
            <path d={`M${L} ${Y(alert).toFixed(1)} L${R} ${Y(alert).toFixed(1)}`} stroke="var(--blue)" strokeWidth={1} opacity={0.6} />
            <text x={926} y={Y(alert)} dy={-6} textAnchor="end" fontSize={12} fill="var(--blue)">Your alert</text>
          </>
        )}
        {best && bestX != null && <circle cx={bestX} cy={Y(best.value)} r={6} fill="var(--blue)" />}
      </svg>
      <SrTable
        caption="Value history and forecast"
        head={['Date', 'Value', 'Likely low', 'Likely high']}
        rows={[
          ...history.map((p) => [p.date, usd(p.value), '', '']),
          ...forecast.map((f) => [monthLabel(f.month), usd(f.mid), usd(f.low), usd(f.high)]),
        ]}
      />
    </figure>
  );
}
