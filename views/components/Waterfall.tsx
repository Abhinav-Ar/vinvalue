/**
 * Horizontal waterfall: a starting value, then each adjustment as a bar from the running total
 * before it to the total after it, all on one scale, ending at the result. Zero adjustments show
 * as a hairline so the reader can see they were considered.
 */
import { usd, usdSigned } from '@/views/components/client/format';

export type WaterfallStep = { key: string; label: string; amount: number; reason?: string };

export function Waterfall({ base, steps, total }: {
  base: { label: string; amount: number };
  steps: WaterfallStep[];
  total: { label: string; amount: number };
}) {
  let run = base.amount;
  const rows = steps.map((s) => { const from = run; run += s.amount; return { ...s, from, to: run }; });
  const values = [base.amount, total.amount, ...rows.flatMap((r) => [r.from, r.to])];
  const max = Math.max(...values), min = Math.min(...values);
  // Scale starts below the smallest total so the bars compare changes, not absolute size; the base bar is cut (marked by its left gap).
  const a = Math.max(0, min - (max - min || max * 0.1) * 1.2), b = max + (max - min) * 0.05 + 1;
  const x = (v: number) => ((v - a) / (b - a)) * 100;
  const span = (from: number, to: number) => ({ left: `${x(Math.min(from, to))}%`, width: `${Math.abs(x(to) - x(from))}%` });

  return (
    <ol className="wf">
      <li>
        <span className="wf-l">{base.label}</span>
        <span className="track" aria-hidden="true"><span className="bar" style={span(a, base.amount)} /></span>
        <span className="wf-v">{usd(base.amount)}</span>
      </li>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="wf-l">{r.label}</span>
          <span className="track" aria-hidden="true">
            <span className={`bar ${r.amount > 0 ? 'up' : r.amount < 0 ? 'down' : 'zero'}`} style={r.amount === 0 ? { left: `${x(r.from)}%` } : span(r.from, r.to)} />
          </span>
          <span className="wf-v">{r.amount === 0 ? '$0' : usdSigned(r.amount)}</span>
          {r.reason && <p className="wf-r">{r.reason}</p>}
        </li>
      ))}
      <li className="total">
        <span className="wf-l">{total.label}</span>
        <span className="track" aria-hidden="true"><span className="bar" style={span(a, total.amount)} /></span>
        <span className="wf-v" style={{ color: 'var(--blue)' }}>{usd(total.amount)}</span>
      </li>
    </ol>
  );
}
