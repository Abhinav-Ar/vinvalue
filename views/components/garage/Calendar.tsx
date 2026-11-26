'use client';
/**
 * Month grid for service events and document renewals (design/Garage-Maintenance.dc.html).
 */
import Link from 'next/link';
import { Skeleton } from '@/views/components/ui';
import styles from './garage.module.css';
import { badgeClass, type Badge } from './shared';

export type CalendarItem = {
  kind: 'service' | 'renewal';
  id: string;
  vehicleId: string;
  vehicle: Badge;
  type: string;
  title: string;
  date: string;
  status: 'scheduled' | 'done' | 'skipped' | 'renewal';
  overdue: boolean;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const monthLabel = (y: number, m0: number) => `${MONTHS[m0]} ${y}`;

export function Calendar({ year, month, today, items, legend, loading, onPrev, onNext, onToday, onSelect, selectedId }: {
  year: number;
  /** 0-based month. */
  month: number;
  /** YYYY-MM-DD (the server's date for the user). */
  today: string;
  items: CalendarItem[];
  legend: Badge[];
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelect: (item: CalendarItem) => void;
  selectedId?: string | null;
}) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const byDay = new Map<number, CalendarItem[]>();
  for (const it of items) {
    if (!it.date.startsWith(prefix)) continue;
    const d = Number(it.date.slice(8, 10));
    byDay.set(d, [...(byDay.get(d) ?? []), it]);
  }
  const cells: ({ d: number } | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push({ d });
  while (cells.length % 7) cells.push(null);
  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const isThisMonth = today.startsWith(prefix);
  const label = monthLabel(year, month);

  return (
    <section className={`sheet ${styles.group}`} tabIndex={0} role="region" aria-label="Maintenance calendar">
      <div className={styles.calendarHead}>
        <h2 className="h3" aria-live="polite">{label}</h2>
        <div className="row">
          <button type="button" className="ghost" onClick={onPrev} aria-label="Previous month">←</button>
          <button type="button" className="ghost" onClick={onNext} aria-label="Next month">→</button>
          <button type="button" className="ghost" onClick={onToday} disabled={isThisMonth} aria-label="Go to the current month">Today</button>
        </div>
      </div>
      <div className="row">
        {legend.map((b) => (
          <span key={b.index} className={`small ${styles.legendItem}`}>
            <span className={badgeClass(b.index)} aria-hidden="true">{b.letter}</span>{b.label}
          </span>
        ))}
      </div>
      <div>
        <div className={styles.calendarGrid} aria-hidden="true">
          {DOW.map((d) => <div key={d} className={`small ${styles.weekday}`}>{d}</div>)}
        </div>
        <div role="list" aria-label={`Service calendar, ${label}`} aria-busy={loading || undefined}>
          {weeks.map((w, wi) => (
            <div className={styles.calendarGrid} key={wi} role="presentation">
              {w.map((c, ci) => {
                if (!c) return <div key={ci} className={styles.day} aria-hidden="true" />;
                const date = `${prefix}${String(c.d).padStart(2, '0')}`;
                const isToday = date === today;
                const evs = byDay.get(c.d) ?? [];
                return (
                  <div key={ci} className={isToday ? `${styles.day} ${styles.today}` : styles.day} role="listitem" aria-label={evs.length ? undefined : `${MONTHS[month]} ${c.d}, nothing scheduled`}>
                    <time className="small" dateTime={date} aria-current={isToday ? 'date' : undefined}>
                      <span className="sr">{MONTHS[month]} </span>{c.d}
                    </time>
                    {loading && !evs.length && c.d % 9 === 3 && <Skeleton h={22} />}
                    {evs.map((e) => <Chip key={`${e.kind}-${e.id}`} e={e} selected={selectedId === e.id} onSelect={onSelect} />)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ e, selected, onSelect }: { e: CalendarItem; selected: boolean; onSelect: (e: CalendarItem) => void }) {
  const state = e.status === 'done' ? ', done' : e.status === 'skipped' ? ', skipped' : e.overdue ? ', overdue' : '';
  const cls = [
    'small', styles.event, e.overdue && styles.overdue,
    (e.status === 'done' || e.status === 'skipped') && styles.muted,
    e.status === 'skipped' && styles.skipped,
  ].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className={badgeClass(e.vehicle.index)} aria-hidden="true">{e.vehicle.letter}</span>
      <span className={styles.eventLabel}>
        {e.status === 'done' && <span aria-hidden="true">✓ </span>}
        {e.title}
      </span>
      <span className="sr">, {e.vehicle.label}{state}</span>
    </>
  );
  if (e.kind === 'renewal') {
    return <Link href={`/garage/${e.vehicleId}`} className={cls} title={e.title}>{inner}</Link>;
  }
  return (
    <button type="button" className={cls} title={e.title} onClick={() => onSelect(e)} aria-pressed={selected}>
      {inner}
    </button>
  );
}
