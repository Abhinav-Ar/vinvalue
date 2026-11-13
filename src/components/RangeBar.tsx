/**
 * Dimension-line range (".dim" from the design): low |----o----| high.
 * `value` places the marker between low and high.
 */
import { usd } from '@/lib/client/format';

export function RangeBar({ low, high, value, label, format = usd }: {
  low: number; high: number; value: number; label?: string; format?: (n: number) => string;
}) {
  const pct = high > low ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100)) : 50;
  return (
    <div role="img" aria-label={label ?? `Range ${format(low)} to ${format(high)}, estimate ${format(value)}`}>
      <div className="dim" aria-hidden="true">
        <span>{format(low)}</span>
        <i><b style={{ left: `${pct}%` }} /></i>
        <span>{format(high)}</span>
      </div>
    </div>
  );
}
