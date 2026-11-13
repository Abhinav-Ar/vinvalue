'use client';
/**
 * Month grid for service events and document renewals (design/Garage-Maintenance.dc.html).
 * Chips: `.chip`, overdue `.chip.late`; car badges `.bdg .b1/.b2/.b3` differ by fill style.
 * Wrapped in `.scroll-x` so it scrolls sideways in its own box on phones.
 */
import Link from 'next/link';
import { Skeleton } from '@/components/ui';
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
    <div className="sheet scroll-x" tabIndex={0} role="region" aria-label="Maintenance calendar">
      <div style={{ minWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" className="ghost" onClick={onPrev} aria-label="Previous month">&#8592;</button>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, minWidth: 220, textAlign: 'center' }} aria-live="polite">{label}</h2>
            <button type="button" className="ghost" onClick={onNext} aria-label="Next month">&#8594;</button>
            <button type="button" className="ghost" onClick={onToday} disabled={isThisMonth} aria-label="Go to the current month">Today</button>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {legend.map((b) => (
              <span key={b.letter} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span className={badgeClass(b.index)} aria-hidden="true">{b.letter}</span>{b.label}
              </span>
            ))}
          </div>
        </div>
        <div className="cal-row" aria-hidden="true">
          {DOW.map((d) => <div key={d} className="label" style={{ padding: '10px 8px', borderBottom: '1px solid var(--ink)' }}>{d}</div>)}
        </div>
        <div role="list" aria-label={`Service calendar, ${label}`} aria-busy={loading || undefined}>
          {weeks.map((w, wi) => (
            <div className="cal-row" key={wi}>
              {w.map((c, ci) => {
                if (!c) return <div key={ci} className="day off" aria-hidden="true" />;
                const date = `${prefix}${String(c.d).padStart(2, '0')}`;
                const isT = date === today;
                const evs = byDay.get(c.d) ?? [];
                return (
                  <div key={ci} className={isT ? 'day today' : 'day'} role="listitem" aria-label={evs.length ? undefined : `${MONTHS[month]} ${c.d}, nothing scheduled`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="mono small"><span className="sr">{MONTHS[month]} </span>{c.d}</span>
                      {isT && <span className="small" style={{ fontWeight: 600, color: 'var(--ink)' }}>Today</span>}
                    </div>
                    {loading && !evs.length && c.d % 9 === 3 ? <Skeleton h={22} /> : null}
                    {evs.map((e) => <Chip key={`${e.kind}-${e.id}`} e={e} selected={selectedId === e.id} onSelect={onSelect} />)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ e, selected, onSelect }: { e: CalendarItem; selected: boolean; onSelect: (e: CalendarItem) => void }) {
  const cls = e.overdue ? 'chip late' : 'chip';
  const state = e.status === 'done' ? ', done' : e.status === 'skipped' ? ', skipped' : e.overdue ? ', overdue' : '';
  const muted = e.status === 'done' || e.status === 'skipped';
  const inner = (
    <>
      <span className={badgeClass(e.vehicle.index)} aria-hidden="true">{e.vehicle.letter}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: muted ? 'var(--mid)' : undefined, textDecoration: e.status === 'skipped' ? 'line-through' : undefined }}>
        {e.status === 'done' && <span aria-hidden="true">&#10003; </span>}
        {e.title}
      </span>
      <span className="sr">, {e.vehicle.label}{state}</span>
    </>
  );
  const style = { width: '100%', textAlign: 'left' as const, cursor: 'pointer', font: 'inherit', fontSize: 12, color: 'var(--ink)', textDecoration: 'none', outline: selected ? '2px solid var(--blue)' : undefined, outlineOffset: selected ? 1 : undefined };
  if (e.kind === 'renewal') {
    return <Link href={`/garage/${e.vehicleId}`} className={cls} style={style}>{inner}</Link>;
  }
  return (
    <button type="button" className={cls} style={style} onClick={() => onSelect(e)} aria-pressed={selected}>
      {inner}
    </button>
  );
}
