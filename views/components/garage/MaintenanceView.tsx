'use client';
/**
 * /garage/maintenance, ported from design/Garage-Maintenance.dc.html.
 * Data: /api/service-events (calendar), /api/maintenance/{upcoming,log,spend,intervals}, /api/vehicles,
 * /api/vehicles/:id/overview (recall status).
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorNote, Field, Skeleton } from '@/views/components/ui';
import { api, useApi, type ApiError } from '@/views/components/client/api';
import { longDate, num, shortDate, usd } from '@/views/components/client/format';
import { Calendar, type CalendarItem } from './Calendar';
import {
  GarageTabs, asApiError, badgeClass, localToday, statusText, ymd,
  type Badge, type GarageResponse, type UpcomingMileageItem, type UpcomingResponse,
} from './shared';

type LogRow = {
  id: string; date: string; vehicleId: string; vehicle: string; vehicleLabel: string; service: string; type: string;
  miles: number | null; costCents: number | null; shop: string | null; receipt: { documentId: string; url: string } | null;
};
type SpendResponse = { year: number; vehicles: { vehicleId: string; label: string; vehicleLabel: string; totalCents: number }[]; totalCents: number };
type Interval = { type: string; everyMiles: number | null };
type Recalls = { count: number; checkedAt: string; basis: string } | null;

const SERVICES: { type: string; title: string }[] = [
  { type: 'oil_filter', title: 'Oil + filter' },
  { type: 'tire_rotation', title: 'Tire rotation' },
  { type: 'brake_fluid', title: 'Brake fluid flush' },
  { type: 'brake_pads', title: 'Brake pads' },
  { type: 'battery', title: 'Battery check' },
  { type: 'detail', title: 'Detail + wax' },
  { type: 'cabin_filter', title: 'Cabin air filter' },
  { type: 'coolant', title: 'Coolant check' },
  { type: 'wipers', title: 'Wiper blades' },
  { type: 'inspection', title: 'State inspection' },
];

const usdCents = (c: number) => (c % 100 === 0 ? usd(c / 100) : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const label = { margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--mid)' } as const;

function parseCostCents(s: string): number | null | 'bad' {
  const t = s.replace(/[$,\s]/g, '');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'bad';
  return Math.round(Number(t) * 100);
}
function parseMiles(s: string): number | null | 'bad' {
  const t = s.replace(/[,\s]/g, '').replace(/mi$/i, '');
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : 'bad';
}

export function MaintenanceView() {
  const garage = useApi<GarageResponse>('/api/vehicles');
  const upcoming = useApi<UpcomingResponse>('/api/maintenance/upcoming');
  const today = upcoming.data?.today ?? null;
  const year = Number((today ?? localToday()).slice(0, 4));
  const log = useApi<{ year: number; items: LogRow[] }>(today ? `/api/maintenance/log?year=${year}` : null);
  const spend = useApi<SpendResponse>(today ? `/api/maintenance/spend?year=${year}` : null);

  const [filter, setFilter] = useState<string>('all');
  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [intervals, setIntervals] = useState<Record<string, Interval[]>>({});
  const [recalls, setRecalls] = useState<Record<string, Recalls>>({});

  // ?vehicle=<id> preselects the filter (links from the garage card and the vehicle page).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vehicle');
    if (v) setFilter(v);
  }, []);
  useEffect(() => {
    if (today && !month) setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
  }, [today, month]);

  const range = month ? { from: ymd(month.y, month.m, 1), to: ymd(month.y, month.m + 1, 0) } : null;
  const cal = useApi<{ items: CalendarItem[] }>(range ? `/api/service-events?from=${range.from}&to=${range.to}` : null);

  const vehicles = useMemo(() => garage.data?.vehicles ?? [], [garage.data]);
  const vehicleIds = vehicles.map((v) => v.id).join(',');

  // Mileage bars need each car's interval; recall status comes from each car's overview.
  useEffect(() => {
    if (!vehicleIds) return;
    const ac = new AbortController();
    for (const id of vehicleIds.split(',')) {
      api<{ intervals: Interval[] }>(`/api/maintenance/intervals?vehicleId=${id}`, { signal: ac.signal })
        .then((r) => setIntervals((s) => ({ ...s, [id]: r.intervals }))).catch(() => {});
      api<{ openRecalls: Recalls }>(`/api/vehicles/${id}/overview`, { signal: ac.signal })
        .then((r) => setRecalls((s) => ({ ...s, [id]: r.openRecalls }))).catch(() => {});
    }
    return () => ac.abort();
  }, [vehicleIds]);

  // Badges come from the server (stable letters); fall back to the vehicle order.
  const badges = useMemo(() => {
    const m = new Map<string, Badge>();
    for (const it of upcoming.data?.items ?? []) if (it.vehicle) m.set(it.vehicleId, it.vehicle);
    vehicles.forEach((v, i) => {
      if (!m.has(v.id)) m.set(v.id, { letter: (v.nickname ?? v.label.split(' ')[2] ?? '?').charAt(0).toUpperCase(), label: v.nickname ?? v.label, short: v.nickname ?? v.label, index: i });
    });
    return m;
  }, [upcoming.data, vehicles]);
  const legend = vehicles.map((v) => badges.get(v.id)!).filter(Boolean);
  const shown = (vehicleId: string) => filter === 'all' || filter === vehicleId;

  function reloadAll() {
    void upcoming.reload();
    void cal.reload();
    void log.reload();
    void spend.reload();
    void garage.reload();
  }

  const loadingFirst = garage.loading && !garage.data;
  const pageError = garage.error ?? upcoming.error;

  if (!loadingFirst && garage.data && vehicles.length === 0) {
    return (
      <section className="wrap" style={{ paddingTop: 64, paddingBottom: 40 }}>
        <h1 className="title">Maintenance</h1>
        <GarageTabs on="maintenance" />
        <div style={{ marginTop: 32 }}>
          <EmptyState text="Add a car to your garage to track its maintenance." action={<Link className="btn" href="/appraise">Appraise a car</Link>} />
        </div>
      </section>
    );
  }

  const dueNext = (upcoming.data?.dueNext ?? []).filter((d) => shown(d.vehicleId)).slice(0, 6);
  const byMileage = (() => {
    const out: UpcomingMileageItem[] = [];
    const seen = new Set<string>();
    for (const it of upcoming.data?.byMileage ?? []) {
      if (!shown(it.vehicleId) || seen.has(it.vehicleId)) continue;
      seen.add(it.vehicleId);
      out.push(it);
    }
    return out;
  })();
  const calItems = (cal.data?.items ?? []).filter((i) => shown(i.vehicleId));
  const logRows = (log.data?.items ?? []).filter((r) => shown(r.vehicleId));
  const csvHref = `/api/maintenance/log?format=csv&year=${year}${filter !== 'all' ? `&vehicleId=${filter}` : ''}`;

  return (
    <section className="wrap" style={{ paddingTop: 64, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="title">Maintenance</h1>
          <p className="lede" style={{ marginTop: 14, maxWidth: 640 }}>Upcoming service for all your cars. Services you log count as service history on your next appraisal.</p>
        </div>
        <div className="segs" role="group" aria-label="Filter by vehicle" style={{ flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'All' }, ...vehicles.map((v) => ({ id: v.id, label: badges.get(v.id)?.label ?? v.label }))].map((f) => (
            <button key={f.id} type="button" className={f.id === filter ? 'seg on' : 'seg'} aria-pressed={f.id === filter} onClick={() => { setFilter(f.id); setSelected(null); }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <GarageTabs on="maintenance" />

      {pageError && <div style={{ marginTop: 32 }}><ErrorNote error={pageError} onRetry={reloadAll} /></div>}

      <div className="g2" style={{ gridTemplateColumns: 'minmax(0,8fr) minmax(0,4fr)', gap: 24, marginTop: 32, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          {month && today ? (
            <Calendar
              year={month.y}
              month={month.m}
              today={today}
              items={calItems}
              legend={filter === 'all' ? legend : legend.filter((b) => badges.get(filter) === b)}
              loading={cal.loading}
              onPrev={() => { setSelected(null); setMonth((p) => p && (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })); }}
              onNext={() => { setSelected(null); setMonth((p) => p && (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })); }}
              onToday={() => { setSelected(null); setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); }}
              onSelect={(e) => setSelected((s) => (s?.id === e.id ? null : e))}
              selectedId={selected?.id}
            />
          ) : (
            <Skeleton h={760} />
          )}
          {cal.error && <ErrorNote error={cal.error} onRetry={cal.reload} />}
          {!cal.loading && cal.data && calItems.length === 0 && month && (
            <p className="small" style={{ margin: 0 }}>No maintenance scheduled this month. Use the form to schedule a service.</p>
          )}
          {selected && today && (
            <EventPanel key={selected.id} item={selected} today={today} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); reloadAll(); }} />
          )}

          <div className="sheet" style={{ padding: '8px 8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 12px 4px', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={label}>Service log, {year}</h2>
              <a href={csvHref} className="small" download style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Export CSV</a>
            </div>
            <div className="scroll-x" tabIndex={0} role="region" aria-label="Service log table">
              <table className="tbl">
                <thead>
                  <tr><th>Date</th><th>Vehicle</th><th>Service</th><th className="num">Miles</th><th className="num">Cost</th><th>Where</th><th><span className="sr">Receipt</span></th></tr>
                </thead>
                <tbody>
                  {log.loading && !log.data && [0, 1, 2].map((i) => <tr key={i}><td colSpan={7}><Skeleton h={18} /></td></tr>)}
                  {log.data && logRows.length === 0 && <tr><td colSpan={7} className="small">No services logged in {year} yet.</td></tr>}
                  {logRows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{longDate(r.date)}</td>
                      <td>{r.vehicle}</td>
                      <td>{r.service}</td>
                      <td className="num">{num(r.miles)}</td>
                      <td className="num">{r.costCents == null ? '–' : usdCents(r.costCents)}</td>
                      <td>{r.shop ?? '–'}</td>
                      <td>{r.receipt ? <a href={r.receipt.url}>Receipt</a> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {log.error && <div style={{ padding: 12 }}><ErrorNote error={log.error} onRetry={log.reload} /></div>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div className="sheet" style={{ padding: 22 }}>
            <h2 style={label}>Due next</h2>
            {upcoming.loading && !upcoming.data && [0, 1, 2].map((i) => <Skeleton key={i} h={44} style={{ marginTop: 12 }} />)}
            {upcoming.data && dueNext.length === 0 && (
              <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                <p style={{ margin: 0 }}>No maintenance scheduled.</p>
                <a className="btn-o" href="#log-form">Schedule a service</a>
              </div>
            )}
            {dueNext.map((d, i) => (
              <div key={`${d.vehicleId}-${d.type}-${d.date}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                {d.vehicle && <span className={badgeClass(d.vehicle.index)} aria-hidden="true">{d.vehicle.letter}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{d.title}</div>
                  <div className="small">{d.vehicle?.label}, {shortDate(d.date)}{d.source === 'interval' ? ', by interval' : ''}</div>
                </div>
                <span className={d.overdue ? 'stat late' : 'stat'}>{d.statusText}</span>
              </div>
            ))}
          </div>

          <div className="sheet" style={{ padding: 22 }}>
            <h2 style={label}>By mileage</h2>
            {upcoming.loading && !upcoming.data && [0, 1, 2].map((i) => <Skeleton key={i} h={48} style={{ marginTop: 12 }} />)}
            {upcoming.data && byMileage.length === 0 && <p className="small" style={{ margin: '12px 0 0' }}>No mileage-based service is tracked for this car.</p>}
            {byMileage.map((it, idx) => {
              const every = intervals[it.vehicleId]?.find((i) => i.type === it.type)?.everyMiles ?? null;
              const pct = every ? Math.min(100, Math.max(0, ((it.currentMiles - (it.dueAtMiles - every)) / every) * 100)) : null;
              return (
                <div key={`${it.vehicleId}-${it.type}-${idx}`} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    {it.vehicle && <span className={badgeClass(it.vehicle.index)} aria-hidden="true">{it.vehicle.letter}</span>}
                    <span style={{ flex: 1 }}>{it.title}<span className="sr">, {it.vehicle?.label}</span></span>
                    <span className={it.overdue ? 'stat late' : 'mono small'}>{it.statusText}</span>
                  </div>
                  <div className="dim" role="img" aria-label={`${it.title}: odometer ${num(it.currentMiles)} mi, due at ${num(it.dueAtMiles)} mi`}>
                    <span>{num(it.currentMiles)}</span>
                    <i>{pct != null && <b style={{ left: `${pct}%` }} />}</i>
                    <span>{num(it.dueAtMiles)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <LogForm
            vehicles={vehicles.map((v) => ({ id: v.id, label: v.label }))}
            preselect={filter !== 'all' ? filter : null}
            today={today}
            onAdded={(date) => {
              setMonth({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
              reloadAll();
            }}
          />

          <div className="sheet" style={{ padding: 22 }}>
            <h2 style={label}>Spend this year</h2>
            {spend.loading && !spend.data && <Skeleton h={120} style={{ marginTop: 12 }} />}
            {spend.data?.vehicles.map((v) => (
              <div key={v.vehicleId} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 0' }}>
                <span>{v.label}</span>
                <span style={{ flex: 1, borderBottom: '1px dotted var(--mid)' }} />
                <span className="mono">{usdCents(v.totalCents)}</span>
              </div>
            ))}
            {spend.data && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 0' }}>
                <span>All vehicles, {spend.data.year}</span>
                <span style={{ flex: 1, borderBottom: '1px dotted var(--mid)' }} />
                <span className="mono">{usdCents(spend.data.totalCents)}</span>
              </div>
            )}
            {spend.error && <ErrorNote error={spend.error} onRetry={spend.reload} />}
          </div>

          <RecallNote vehicles={vehicles.filter((v) => shown(v.id)).map((v) => ({ id: v.id, label: badges.get(v.id)?.label ?? v.label }))} recalls={recalls} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ recall note */

function RecallNote({ vehicles, recalls }: { vehicles: { id: string; label: string }[]; recalls: Record<string, Recalls> }) {
  const loaded = vehicles.every((v) => v.id in recalls);
  const lines = vehicles.map((v) => ({ ...v, r: recalls[v.id] }));
  const unchecked = lines.filter((l) => l.r === null);
  return (
    <div className="sheet" style={{ padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 2 }}>
        <path d="M11 2 L20 18 L2 18 Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11 8 L11 13 M11 15 L11 16" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>Recall check</h2>
        {!loaded ? (
          <Skeleton h={36} style={{ marginTop: 6 }} />
        ) : (
          <>
            {lines.filter((l) => l.r).map((l) => (
              <p key={l.id} className="small" style={{ margin: '4px 0 0' }}>
                {l.label}: {l.r!.count === 0 ? 'no open recalls found for the model year' : `${l.r!.count} recall${l.r!.count === 1 ? '' : 's'} may apply to your model year`}, checked {shortDate(l.r!.checkedAt)}.
              </p>
            ))}
            {unchecked.length > 0 && (
              <p className="small" style={{ margin: '4px 0 0' }}>{unchecked.map((l) => l.label).join(', ')}: not checked yet.</p>
            )}
            <p className="small" style={{ margin: '4px 0 0' }}>
              We check NHTSA recalls for each model year weekly. Confirm by VIN at <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">nhtsa.gov/recalls</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- log form */

function LogForm({ vehicles, preselect, today, onAdded }: {
  vehicles: { id: string; label: string }[]; preselect: string | null; today: string | null; onAdded: (date: string) => void;
}) {
  const [car, setCar] = useState('');
  const [svc, setSvc] = useState(SERVICES[0]!.type);
  const [date, setDate] = useState('');
  const [odo, setOdo] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<ApiError | null>(null);
  const [added, setAdded] = useState('');
  const carRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (preselect) setCar(preselect);
    else if (!car && vehicles[0]) setCar(vehicles[0].id);
  }, [preselect, vehicles, car]);
  useEffect(() => {
    if (today && !date) setDate(today);
  }, [today, date]);

  async function add() {
    setFields({});
    setErr(null);
    setAdded('');
    const f: Record<string, string[]> = {};
    const miles = parseMiles(odo);
    const cents = parseCostCents(cost);
    if (!car) f.vehicle = ['Pick a vehicle.'];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) f.date = ['Pick a date.'];
    if (miles === 'bad') f.odometer = ['Enter whole miles, like 38200.'];
    if (cents === 'bad') f.cost = ['Enter an amount, like 74.50.'];
    if (Object.keys(f).length) { setFields(f); return; }
    const t = today ?? localToday();
    // Past dates are logged as done; future dates are scheduled. Today counts as done once miles or cost is entered.
    const done = date < t || (date === t && (miles != null || cents != null));
    const title = SERVICES.find((s) => s.type === svc)!.title;
    setBusy(true);
    try {
      await api('/api/service-events', {
        body: { vehicleId: car, type: svc, title, date, status: done ? 'done' : 'scheduled', odometer: miles, costCents: cents },
      });
      setAdded(`${title} ${done ? 'logged for' : 'scheduled for'} ${shortDate(date)}`);
      setOdo('');
      setCost('');
      onAdded(date);
    } catch (e) {
      const ae = asApiError(e);
      const fe = ae.fields;
      const mapped: Record<string, string[]> = {};
      if (fe.miles || fe.odometer) mapped.odometer = fe.miles ?? fe.odometer!;
      if (fe.date) mapped.date = fe.date;
      if (fe.costCents) mapped.cost = fe.costCents;
      if (fe.vehicleId) mapped.vehicle = fe.vehicleId;
      setFields(mapped);
      // Form-level line only when it says something the field errors do not (no "Some fields are invalid." echo).
      const shown = new Set(Object.values(mapped).flat());
      setErr(!Object.keys(mapped).length || (ae.message && !shown.has(ae.message) && ae.code !== 'invalid_input') ? ae : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id="log-form" className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); void add(); }} noValidate>
      <h2 style={label}>Log or schedule a service</h2>
      <Field label="Vehicle" errors={fields.vehicle}>
        {({ id, describedBy, invalid }) => (
          <select ref={carRef} id={id} className="inp" value={car} onChange={(e) => setCar(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Service">
        {({ id }) => (
          <select id={id} className="inp" value={svc} onChange={(e) => setSvc(e.target.value)}>
            {SERVICES.map((s) => <option key={s.type} value={s.type}>{s.title}</option>)}
          </select>
        )}
      </Field>
      <div className="g2" style={{ gap: 12 }}>
        <Field label="Date" errors={fields.date}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="date" className="inp mono" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
        <Field label="Odometer" errors={fields.odometer}>
          {({ id, describedBy, invalid }) => (
            <input id={id} className="inp mono" inputMode="numeric" placeholder="miles" value={odo} onChange={(e) => setOdo(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>
      </div>
      <Field label="Cost (optional)" errors={fields.cost}>
        {({ id, describedBy, invalid }) => (
          <input id={id} className="inp mono" inputMode="decimal" placeholder="$0.00" value={cost} onChange={(e) => setCost(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <p className="small" style={{ margin: 0 }}>A past date logs the service as done. A future date schedules it.</p>
      <button type="submit" className="btn" disabled={busy || !vehicles.length}>{busy ? 'Adding' : 'Add to calendar'}</button>
      {err && <p className="err" role="alert">{err.message}</p>}
      {added && <p className="small" style={{ margin: 0, color: 'var(--ink)' }} role="status">{added}</p>}
    </form>
  );
}

/* ------------------------------------------------------------ event panel */

function EventPanel({ item, today, onClose, onChanged }: { item: CalendarItem; today: string; onClose: () => void; onChanged: () => void }) {
  const [odo, setOdo] = useState('');
  const [cost, setCost] = useState('');
  const [newDate, setNewDate] = useState(item.date);
  const [busy, setBusy] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headRef.current?.focus(); }, []);

  async function run(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    setErr(null);
    setFields({});
    try {
      await fn();
      onChanged();
    } catch (e) {
      const ae = asApiError(e);
      const fe = ae.fields;
      const mapped: Record<string, string[]> = {};
      if (fe.miles || fe.odometer) mapped.odometer = fe.miles ?? fe.odometer!;
      if (fe.date) mapped.date = fe.date;
      if (fe.costCents) mapped.cost = fe.costCents;
      setFields(mapped);
      setErr(ae);
    } finally {
      setBusy(null);
    }
  }

  function markDone() {
    const miles = parseMiles(odo);
    const cents = parseCostCents(cost);
    const f: Record<string, string[]> = {};
    if (miles === 'bad') f.odometer = ['Enter whole miles, like 38200.'];
    if (cents === 'bad') f.cost = ['Enter an amount, like 74.50.'];
    if (Object.keys(f).length) { setFields(f); return; }
    // Completed services cannot be dated in the future: a future event is completed today.
    const date = item.date > today ? today : item.date;
    void run('done', () => api(`/api/service-events/${item.id}`, { method: 'PATCH', body: { status: 'done', date, odometer: miles, costCents: cents } }));
  }

  const scheduled = item.status === 'scheduled';
  const when = item.status === 'done' ? `done ${longDate(item.date)}` : item.status === 'skipped' ? `skipped, ${longDate(item.date)}` : `${longDate(item.date)}, ${statusText(item.date, today)}`;

  return (
    <div className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }} aria-label="Selected service">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className={badgeClass(item.vehicle.index)} aria-hidden="true">{item.vehicle.letter}</span>
          <div>
            <h3 ref={headRef} tabIndex={-1} style={{ margin: 0, fontSize: 17, fontWeight: 600, outline: 'none' }}>{item.title}</h3>
            <p className="small" style={{ margin: '4px 0 0' }}>{item.vehicle.label}, {when}</p>
          </div>
        </div>
        <button type="button" className="ghost" onClick={onClose}>Close</button>
      </div>

      {scheduled && (
        <>
          <div className="g2" style={{ gap: 12 }}>
            <Field label="Odometer (optional)" errors={fields.odometer}>
              {({ id, describedBy, invalid }) => <input id={id} className="inp mono" inputMode="numeric" placeholder="miles" value={odo} onChange={(e) => setOdo(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
            </Field>
            <Field label="Cost (optional)" errors={fields.cost}>
              {({ id, describedBy, invalid }) => <input id={id} className="inp mono" inputMode="decimal" placeholder="$0.00" value={cost} onChange={(e) => setCost(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
            </Field>
          </div>
          <button type="button" className="btn" onClick={markDone} disabled={!!busy}>
            {busy === 'done' ? 'Saving' : item.date > today ? 'Mark done today' : 'Mark done'}
          </button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="New date" errors={fields.date} style={{ flex: '1 1 180px' }}>
              {({ id, describedBy, invalid }) => <input id={id} type="date" className="inp mono" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
            </Field>
            <button type="button" className="btn-o" disabled={!!busy || !newDate || newDate === item.date} onClick={() => void run('move', () => api(`/api/service-events/${item.id}`, { method: 'PATCH', body: { date: newDate } }))}>
              {busy === 'move' ? 'Moving' : 'Move to this date'}
            </button>
          </div>
        </>
      )}

      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="Confirm delete">
          <span>Delete this service from the calendar?</span>
          <button type="button" className="btn-o" disabled={!!busy} onClick={() => void run('delete', () => api(`/api/service-events/${item.id}`, { method: 'DELETE' }))}>
            {busy === 'delete' ? 'Deleting' : 'Yes, delete'}
          </button>
          <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
        </div>
      ) : (
        <button type="button" className="btn-o" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDelete(true)} disabled={!!busy}>Delete service</button>
      )}
      {err && <p className="err" role="alert">{err.message}</p>}
    </div>
  );
}
