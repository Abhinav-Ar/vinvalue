/**
 * Listings by asking price (design/Market). The bucket holding your car is cobalt.
 */
import { usd } from '@/views/components/client/format';
import { ChartEmpty, SrTable } from './shared';
import styles from './charts.module.css';

export type Bucket = { from: number; to: number; count: number };

const W = 600;
const H = 250;
const BASE = 200;
const TOP = 20;

const k = (n: number) => {
  const v = n / 1000;
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
};
/** "$22–24k" (en dash for a numeric range). */
const rangeLabel = (b: Bucket) => `$${k(b.from)}–${k(b.to)}k`;

export function PriceBuckets({ buckets, yourIndex, yourValue }: { buckets: Bucket[]; yourIndex?: number | null; yourValue?: number | null }) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const rows = buckets.map((b, i) => [`${usd(b.from)} to ${usd(b.to)}`, b.count, i === yourIndex ? 'Your car' : '']);
  if (!buckets.length || total === 0) {
    return <ChartEmpty>No local listings. Try a wider radius.</ChartEmpty>;
  }

  const n = buckets.length;
  const slot = (W - 20) / n;
  const bw = Math.min(80, slot * 0.75);
  const max = Math.max(...buckets.map((b) => b.count));
  const hasYou = yourIndex != null && yourIndex >= 0 && yourIndex < n;
  const xOf = (i: number) => 10 + i * slot + (slot - bw) / 2;

  const summary =
    `${total} listings in ${n} price ranges from ${usd(buckets[0]!.from)} to ${usd(buckets[n - 1]!.to)}.` +
    (hasYou ? ` Your car${yourValue != null ? `, at ${usd(yourValue)},` : ''} falls in ${usd(buckets[yourIndex!]!.from)} to ${usd(buckets[yourIndex!]!.to)}, with ${buckets[yourIndex!]!.count} listings.` : '');

  return (
    <figure className={`${styles.plot} ${styles.buckets}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary}>
        {buckets.map((b, i) => {
          const h = max ? (b.count / max) * (BASE - TOP) : 0;
          const you = hasYou && i === yourIndex;
          return (
            <g key={i}>
              <rect x={xOf(i)} y={BASE - h} width={bw} height={h} fill={you ? 'var(--blue)' : 'var(--mid)'} />
              <text x={xOf(i) + bw / 2} y={222} textAnchor="middle" className={`${styles.axis} ${styles.numeric}`}>{rangeLabel(b)}</text>
            </g>
          );
        })}
        <path d={`M10 ${BASE} L${W - 10} ${BASE}`} stroke="var(--line-strong)" />
        {hasYou && (
          <text x={Math.min(W - 85, Math.max(85, xOf(yourIndex!) + bw / 2))} y={244} textAnchor="middle" className={`${styles.annotation} ${styles.active}`}>
            Your car{yourValue != null ? ` ${usd(yourValue)}` : ''}
          </text>
        )}
      </svg>
      <SrTable caption="Listings by asking price" head={['Price range', 'Listings', '']} rows={rows} />
    </figure>
  );
}
