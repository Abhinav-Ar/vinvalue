/**
 * Price vs mileage for the comparable listings, hand-written SVG (Report page).
 * Listings used: hollow circles. Outliers left out: crosses (triangles at the edge when their price
 * is off the chart). Other trims left out: hollow squares. Your car: filled cobalt dot with crosshair.
 * Prices are private-sale equivalents (adjustedPrice), the same basis as the estimate.
 */
import type { ReactNode } from 'react';
import type { ReportComp } from '@/models/appraisals/report';
import { usd, num } from '@/views/components/client/format';

const W = 560, H = 340, L = 56, R = 544, T = 16, B = 292;

type Kind = 'used' | 'outlier' | 'trim';
const kindOf = (c: ReportComp): Kind => (c.excludedAsOutlier ? 'outlier' : c.trimMatch === 'excluded' ? 'trim' : 'used');
const priceOf = (c: ReportComp) => c.adjustedPrice ?? c.price;

function step(range: number, target: number) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
}
function ticks(lo: number, hi: number, target: number) {
  const s = step(hi - lo, target);
  const a = Math.floor(lo / s) * s, b = Math.ceil(hi / s) * s;
  const out: number[] = [];
  for (let v = a; v <= b + s / 2; v += s) out.push(v);
  return out;
}
const kMiles = (n: number) => (n === 0 ? '0' : `${Math.round(n / 1000)}k`);
const kUsd = (n: number) => `$${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k`;

export function CompsScatter({ comps, subject }: { comps: ReportComp[]; subject: { miles: number; value: number } }) {
  const used = comps.filter((c) => kindOf(c) === 'used');
  const basis = used.length ? used : comps;

  const xs = [...comps.map((c) => c.miles), subject.miles];
  const ys = [...basis.map(priceOf), subject.value];
  const xt = ticks(Math.min(...xs), Math.max(...xs), 6);
  const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 1000;
  const yt = ticks(Math.min(...ys) - yPad, Math.max(...ys) + yPad, 5);
  const [x0, x1] = [xt[0]!, xt[xt.length - 1]!];
  const [y0, y1] = [yt[0]!, yt[yt.length - 1]!];
  const sx = (m: number) => L + ((m - x0) / (x1 - x0 || 1)) * (R - L);
  const sy = (p: number) => B - ((p - y0) / (y1 - y0 || 1)) * (B - T);

  // Least-squares trend through the listings used.
  let trend: string | null = null;
  if (used.length >= 3) {
    const n = used.length;
    const mx = used.reduce((a, c) => a + c.miles, 0) / n;
    const my = used.reduce((a, c) => a + priceOf(c), 0) / n;
    const sxx = used.reduce((a, c) => a + (c.miles - mx) ** 2, 0);
    if (sxx > 0) {
      const k = used.reduce((a, c) => a + (c.miles - mx) * (priceOf(c) - my), 0) / sxx;
      const f = (m: number) => Math.min(B, Math.max(T, sy(my + k * (m - mx))));
      trend = `M${L} ${f(x0).toFixed(1)} L${R} ${f(x1).toFixed(1)}`;
    }
  }

  // Off-chart outliers sit on the top or bottom edge; nudge repeats so they do not overlap.
  const seen = new Map<string, number>();
  const marks = comps.map((c, i) => {
    const kind = kindOf(c);
    const p = priceOf(c);
    const off = p > y1 ? 'up' : p < y0 ? 'down' : null;
    let x = sx(c.miles);
    const y = off === 'up' ? T + 6 : off === 'down' ? B - 6 : sy(p);
    if (off) {
      const key = `${off}${Math.round(x / 6)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      x += n * 12;
    }
    return { i, kind, x, y, off };
  });

  const outliers = comps.filter((c) => kindOf(c) === 'outlier');
  const otherTrims = comps.filter((c) => kindOf(c) === 'trim');
  const prices = used.map(priceOf);
  const summary =
    `Scatter plot of ${comps.length} comparable listings, private-sale equivalent price against mileage. ` +
    `${used.length} used in the estimate` +
    (prices.length ? `, priced ${usd(Math.min(...prices))} to ${usd(Math.max(...prices))}` : '') +
    `. ${outliers.length ? `${outliers.length} left out as price outliers. ` : ''}` +
    `${otherTrims.length ? `${otherTrims.length} other-trim listings left out. ` : ''}` +
    `Your car: ${num(subject.miles)} miles, estimated ${usd(subject.value)}.`;

  const sxv = sx(subject.miles), syv = sy(subject.value);
  const labelLeft = sxv > R - 90;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ display: 'block' }}>
        <g stroke="var(--line)" strokeWidth="1">
          {xt.map((v) => <path key={`x${v}`} d={`M${sx(v).toFixed(1)} ${T} L${sx(v).toFixed(1)} ${B}`} />)}
          {yt.map((v) => <path key={`y${v}`} d={`M${L} ${sy(v).toFixed(1)} L${R} ${sy(v).toFixed(1)}`} />)}
        </g>
        <path d={`M${L} ${B} L${R} ${B} M${L} ${T} L${L} ${B}`} stroke="var(--ink)" strokeWidth="1" />
        {trend && <path d={trend} stroke="var(--mid)" strokeDasharray="5 4" strokeWidth="1.2" />}

        {marks.map((m) => {
          if (m.kind === 'used') return <circle key={m.i} cx={m.x} cy={m.y} r="5" fill="none" stroke="var(--ink)" strokeWidth="1.3" />;
          if (m.kind === 'trim') return <rect key={m.i} x={m.x - 4.5} y={m.y - 4.5} width="9" height="9" fill="none" stroke="var(--mid)" strokeWidth="1.3" />;
          if (m.off === 'up') return <path key={m.i} d={`M${m.x} ${m.y - 6} L${m.x + 6} ${m.y + 4} L${m.x - 6} ${m.y + 4} Z`} fill="none" stroke="var(--mid)" strokeWidth="1.3" />;
          if (m.off === 'down') return <path key={m.i} d={`M${m.x} ${m.y + 6} L${m.x + 6} ${m.y - 4} L${m.x - 6} ${m.y - 4} Z`} fill="none" stroke="var(--mid)" strokeWidth="1.3" />;
          return <path key={m.i} d={`M${m.x - 5} ${m.y - 5} L${m.x + 5} ${m.y + 5} M${m.x + 5} ${m.y - 5} L${m.x - 5} ${m.y + 5}`} stroke="var(--mid)" strokeWidth="1.5" />;
        })}

        <g stroke="var(--blue)" strokeWidth="1.5">
          <path d={`M${sxv - 18} ${syv} L${sxv + 18} ${syv} M${sxv} ${syv - 18} L${sxv} ${syv + 18}`} />
        </g>
        <circle cx={sxv} cy={syv} r="8" fill="var(--blue)" />
        <text className="hand" x={labelLeft ? sxv - 14 : sxv + 14} y={syv - 14} textAnchor={labelLeft ? 'end' : 'start'} fontSize="18" fill="var(--blue)" stroke="var(--paper)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">your car</text>

        {xt.map((v) => (
          <text key={`xl${v}`} x={sx(v)} y={310} textAnchor="middle" fontSize="11" fill="var(--mid)" fontFamily="var(--font-sans), sans-serif">{kMiles(v)}</text>
        ))}
        {yt.map((v) => (
          <text key={`yl${v}`} x={L - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="var(--mid)" fontFamily="var(--font-sans), sans-serif">{kUsd(v)}</text>
        ))}
        <text x={(L + R) / 2} y={334} textAnchor="middle" fontSize="11" fill="var(--mid)" fontFamily="var(--font-sans), sans-serif">Mileage</text>
      </svg>
      <figcaption aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 12, fontSize: 13, color: 'var(--mid)' }}>
        <Key shape={<circle cx="8" cy="8" r="5" fill="none" stroke="var(--ink)" strokeWidth="1.3" />}>Listing used</Key>
        {outliers.length > 0 && (
          <Key shape={<path d="M3 3 L13 13 M13 3 L3 13" stroke="var(--mid)" strokeWidth="1.5" />}>
            Price outlier, left out{marks.some((m) => m.off) ? ' (triangles are off the chart)' : ''}
          </Key>
        )}
        {otherTrims.length > 0 && <Key shape={<rect x="3.5" y="3.5" width="9" height="9" fill="none" stroke="var(--mid)" strokeWidth="1.3" />}>Other trim, left out</Key>}
        <Key shape={<circle cx="8" cy="8" r="6" fill="var(--blue)" />}>Your car</Key>
        <span>Prices are private-sale equivalents.</span>
      </figcaption>
    </figure>
  );
}

function Key({ shape, children }: { shape: ReactNode; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{shape}</svg>
      {children}
    </span>
  );
}
