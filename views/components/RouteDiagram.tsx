/**
 * The three ways to sell, placed on one price axis like stations on a dimension line:
 * instant ---- private ---- retail, with the gap between each pair dimensioned underneath and the
 * private range bracketed. HTML positioned in percent so text stays readable at phone width.
 */
import type { CSSProperties } from 'react';
import { usd } from '@/views/components/client/format';

type Route = { key: 'instant' | 'private' | 'retail'; name: string; value: number; note: string };

export function RouteDiagram({ instant, private: priv, retail, low, high, notes, caption }: {
  instant: number; private: number; retail: number;
  /** Private-sale range, drawn as a bracket under the axis. */
  low?: number; high?: number;
  notes?: Partial<Record<Route['key'], string>>;
  caption?: string;
}) {
  const routes: Route[] = [
    { key: 'instant', name: 'Instant sale', value: instant, note: notes?.instant ?? 'Dealer or instant buyer. Fastest, they take the risk.' },
    { key: 'private', name: 'Private sale', value: priv, note: notes?.private ?? 'Most money. You list it and handle the buyers.' },
    { key: 'retail', name: 'Dealer retail', value: retail, note: notes?.retail ?? 'The same car on a lot, prep and margin included.' },
  ];
  const lo = Math.min(instant, low ?? instant), hi = Math.max(retail, high ?? retail);
  const pad = (hi - lo) * 0.2 || 1000;
  const a = lo - pad, b = hi + pad;
  const at = (v: number) => ((v - a) / (b - a)) * 100;
  const pct = (v: number) => `${at(v).toFixed(2)}%`;
  const label = `Instant sale ${usd(instant)}, private sale ${usd(priv)}${low != null && high != null ? ` (likely ${usd(low)} to ${usd(high)})` : ''}, dealer retail ${usd(retail)}.`;

  return (
    <figure className="route" style={{ margin: 0 }} aria-label={label} role="group">
      <div className="route-labels" aria-hidden="true">
        {routes.map((r) => (
          <div key={r.key} className={`route-label${r.key === 'private' ? ' on' : ''}`} style={{ '--x': pct(r.value) } as CSSProperties}>
            <p className="kicker">{r.name}</p>
            <p className="route-v">{usd(r.value)}</p>
          </div>
        ))}
      </div>
      <div className="route-axis" aria-hidden="true">
        <span className="route-line" />
        {low != null && high != null && <span className="route-range" style={{ left: pct(low), width: `${at(high) - at(low)}%` }} />}
        {routes.map((r) => <span key={r.key} className={`route-pin${r.key === 'private' ? ' on' : ''}`} style={{ left: pct(r.value) }} />)}
        {[[instant, priv], [priv, retail]].map(([x, y], i) => (
          <span key={i} className="route-gap" style={{ left: pct(x), width: `${at(y) - at(x)}%` }}>
            <b>+{usd(y - x)}</b>
          </span>
        ))}
      </div>
      <ol className="route-notes">
        {routes.map((r) => (
          <li key={r.key} className={r.key === 'private' ? 'on' : undefined}>
            <span className="sr">{r.name}, {usd(r.value)}. </span>{r.note}
          </li>
        ))}
      </ol>
      {caption && <figcaption className="small" style={{ marginTop: 14 }}>{caption}</figcaption>}
    </figure>
  );
}
