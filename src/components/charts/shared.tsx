/**
 * Helpers shared by the hand-written SVG charts. No chart library, no motion.
 */
import type { ReactNode } from 'react';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2027-03" -> "Mar 2027" */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MON[(m ?? 1) - 1]} ${y}`;
};
/** "2027-03" -> "Mar" */
export const monthShort = (ym: string) => MON[(Number(ym.split('-')[1]) || 1) - 1]!;

/** Compact dollar tick: 27000 -> "$27k", 27500 -> "$27.5k". */
export const kUsd = (n: number) => {
  const k = n / 1000;
  return '$' + (Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)) + 'k';
};

/** Round bounds out to a tick step that gives 3 to 7 gridlines. */
export function niceDomain(min: number, max: number) {
  if (min === max) {
    min -= 1000;
    max += 1000;
  }
  const span = max - min;
  const steps = [250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000];
  const step = steps.find((s) => span / s <= 6) ?? 100000;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-6; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

export const AXIS_TEXT = { fontSize: 11, fill: 'var(--mid)' } as const;

/** Same-size box used when a chart has nothing to draw. */
export function ChartEmpty({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: height,
        border: '1px dashed var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

/** Visually hidden data table so screen readers get the numbers behind a chart. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr">
      <caption>{caption}</caption>
      <thead>
        <tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
