/**
 * Median asking price over 12 months (design/Market). Months without a snapshot are null:
 * the line breaks at gaps instead of bridging them, and with fewer than 2 months there is
 * no line at all, only a plain note.
 */
import { usd } from '@/views/components/client/format';
import { ChartEmpty, SrTable, kUsd, monthLabel } from './shared';
import styles from './charts.module.css';

export type MonthMedian = { month: string; median: number | null };

const W = 640;
const H = 270;
const L = 82;
const R = 630;
const T = 20;
const B = 240;

export function MarketLine({ series, current }: { series: MonthMedian[]; current?: number | null }) {
  const known = series.filter((s): s is { month: string; median: number } => s.median != null);
  const rows = series.map((s) => [monthLabel(s.month), s.median == null ? 'No data' : usd(s.median)]);

  if (known.length < 2) {
    const one = known[0];
    return (
      <>
        <ChartEmpty>
          {one
            ? `One month recorded: ${usd(one.median)} in ${monthLabel(one.month)}.`
            : current != null
              ? `No monthly history yet. Today's median is ${usd(current)}.`
              : 'No monthly history yet.'}
        </ChartEmpty>
        <SrTable caption="Median asking price by month" head={['Month', 'Median asking']} rows={rows} />
      </>
    );
  }

  const n = series.length;
  const X = (i: number) => L + (n > 1 ? (i * (R - L)) / (n - 1) : 0);
  let mn = Math.min(...known.map((k) => k.median));
  let mx = Math.max(...known.map((k) => k.median));
  const pad = Math.max(400, (mx - mn) * 0.1);
  mn -= pad;
  mx += pad;
  const Y = (v: number) => T + ((mx - v) / (mx - mn)) * (B - T);

  // Contiguous runs of known months.
  const runs: { i: number; v: number }[][] = [];
  let run: { i: number; v: number }[] = [];
  series.forEach((s, i) => {
    if (s.median == null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ i, v: s.median });
  });
  if (run.length) runs.push(run);

  const first = known[0]!;
  const last = known[known.length - 1]!;
  const missing = n - known.length;
  const summary =
    `Median asking price from ${monthLabel(first.month)} (${usd(first.median)}) to ${monthLabel(last.month)} (${usd(last.median)}).` +
    (missing ? ` ${missing} of ${n} months have no data.` : '');

  return (
    <figure className={`${styles.plot} ${styles.market}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary}>
        <path fill="none" d={`M${L} ${T} L${R} ${T} M${L} ${(T + B) / 2} L${R} ${(T + B) / 2} M${L} ${B} L${R} ${B}`} stroke="var(--line)" />
        {runs.map((r, k) =>
          r.length > 1 ? (
            <path
              key={k}
              d={r.map((p, j) => (j ? 'L' : 'M') + X(p.i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ')}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
            />
          ) : (
            <circle key={k} cx={X(r[0]!.i)} cy={Y(r[0]!.v)} r={4} fill="var(--ink)" />
          ),
        )}
        <text x={L - 8} y={T + 6} textAnchor="end" className={`${styles.axis} ${styles.numeric}`}>{kUsd(Math.round(mx / 100) * 100)}</text>
        <text x={L - 8} y={B + 4} textAnchor="end" className={`${styles.axis} ${styles.numeric}`}>{kUsd(Math.round(mn / 100) * 100)}</text>
        <text x={L} y={262} className={styles.axis}>{monthLabel(series[0]!.month)}</text>
        <text x={R} y={262} textAnchor="end" className={styles.axis}>{monthLabel(series[n - 1]!.month)}</text>
      </svg>
      <SrTable caption="Median asking price by month" head={['Month', 'Median asking']} rows={rows} />
    </figure>
  );
}
