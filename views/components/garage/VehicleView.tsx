'use client';
/**
 * /garage/[vehicleId], ported from design/Vehicle.dc.html.
 * Data: GET /api/vehicles/:id/overview, /api/vehicles/:id/documents, /api/appraisals?vehicleId (report links),
 * /api/maintenance/upcoming?vehicleId (the server's date). Actions: odometer, refresh value, documents.
 */
import Link from 'next/link';
import { SaleOutcomePrompts, VehicleSaleActions } from './SaleOutcomeCard';
import { notFound } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CarDrawing } from '@/views/components/CarDrawing';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { ErrorNote, Field, Skeleton } from '@/views/components/ui';
import { api, useApi, type ApiError } from '@/views/components/client/api';
import { longDate, miles, num, shortDate, usd, usdSigned } from '@/views/components/client/format';
import { VehicleTabs, asApiError, carVariant, flagText, localToday, postForm, type NextService } from './shared';

type DocSummaryEntry = { status: 'missing' | 'on_file' | 'expiring' | 'expired'; text: string; documentId: string | null; expiresOn: string | null };
type Overview = {
  vehicle: { id: string; label: string; nickname: string | null; vin: string; odometer: number; zip: string; flags: string[] };
  specs: {
    engine: string | null; drive: string | null; body: string | null; fuel: string | null; doors: number | null; plant: string | null;
    decodeStatus: string | null;
    trim: { value: string | null; decoded: string | null; confirmed: boolean; text: string | null };
  };
  reported: { key: string; value: unknown; note: 'you reported' }[];
  privateValue: number | null;
  lastAppraisedAt: string | null;
  changeSinceLast: { amount: number; sinceDate: string } | null;
  sincePurchase: { amount: number; purchasePrice: number } | null;
  nextService: NextService;
  openRecalls: { count: number; checkedAt: string; basis: string } | null;
  timeline: { date: string; kind: 'appraisal' | 'service' | 'purchase'; id: string | null; title: string; detail: string }[];
  documents: { title: DocSummaryEntry; registration: DocSummaryEntry; insurance: DocSummaryEntry; receipts: { count: number; text: string } };
};
type Doc = {
  id: string; kind: string; label: string | null; expiresOn: string | null; hasFile: boolean;
  contentType: string | null; sizeBytes: number | null; downloadUrl: string | null; createdAt: string;
};

const DOC_KINDS = [
  { value: 'title', label: 'Title' },
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance card' },
  { value: 'receipt', label: 'Service receipt' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];
const kindLabel = (k: string) => DOC_KINDS.find((d) => d.value === k)?.label ?? k;

const DRIVE: Record<string, string> = { RWD: 'rear-wheel drive', FWD: 'front-wheel drive', AWD: 'all-wheel drive', '4WD': 'four-wheel drive' };
const REPORTED_KEYS: Record<string, string> = {
  condition: 'Condition', accidents: 'Accidents', title: 'Title', owners: 'Owners', keys: 'Keys', warningLights: 'Warning lights', serviceHistory: 'Service history',
};
const REPORTED_VALUES: Record<string, Record<string, string>> = {
  accidents: { none: 'None', minor: 'Minor', major: 'Major' },
  keys: { two: 'Two keys', one: 'One key' },
  warningLights: { none: 'None', check_engine: 'Check engine light', other: 'Other warning light' },
  serviceHistory: { full: 'Full records', partial: 'Some records', none: 'No records' },
};
function reportedValue(key: string, v: unknown): string {
  if (v == null) return 'Not answered';
  if (key === 'owners') return v === 3 ? '3 or more' : String(v);
  const s = String(v);
  return REPORTED_VALUES[key]?.[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

const sheetLabel = { margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--mid)' } as const;
const statBig: CSSProperties = { margin: '6px 0 0', fontSize: 26 };
const statSub: CSSProperties = { margin: '4px 0 0' };

export function VehicleView({ id }: { id: string }) {
  const ov = useApi<Overview>(`/api/vehicles/${id}/overview`);
  const apps = useApi<{ items: { id: string; shareSlug: string }[] }>(`/api/appraisals?vehicleId=${id}`);
  const docs = useApi<{ documents: Doc[] }>(`/api/vehicles/${id}/documents`);
  const up = useApi<{ today: string }>(`/api/maintenance/upcoming?vehicleId=${id}&limit=1`);
  const today = up.data?.today ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const [refreshErr, setRefreshErr] = useState<ApiError | null>(null);
  const [refreshed, setRefreshed] = useState('');

  if (ov.error?.status === 404) notFound();

  async function refresh() {
    setRefreshing(true);
    setRefreshErr(null);
    setRefreshed('');
    try {
      const r = await api<{ private: { value: number } }>(`/api/vehicles/${id}/refresh-value`, { method: 'POST' });
      setRefreshed(`New private sale value: ${usd(r.private.value)}`);
      void ov.reload();
      void apps.reload();
    } catch (e) {
      setRefreshErr(asApiError(e));
    } finally {
      setRefreshing(false);
    }
  }

  const d = ov.data;
  if (ov.error && !d) {
    return (
      <section className="wrap" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <Link href="/garage" className="small" style={{ textDecoration: 'none' }}>&#8592; Garage</Link>
        <div style={{ marginTop: 24 }}><ErrorNote error={ov.error} onRetry={ov.reload} /></div>
      </section>
    );
  }

  const slugs = new Map((apps.data?.items ?? []).map((a) => [a.id, a.shareSlug]));
  const s = d?.specs;
  const headLine = d && s
    ? [
        [s.body, s.drive ? (DRIVE[s.drive] ?? s.drive) : null, s.engine].filter(Boolean).join(', '),
        `${num(d.vehicle.odometer)} miles, ZIP ${d.vehicle.zip}`,
      ].filter(Boolean).join('. ') + '. '
    : '';

  return (
    <section className="wrap" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="g2" style={{ gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)', gap: 40, alignItems: 'end' }}>
        <div>
          <Link href="/garage" className="small" style={{ textDecoration: 'none', display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>&#8592; Garage</Link>
          {d ? (
            <>
              <h1 className="title" style={{ marginTop: 8 }}>{d.vehicle.label}</h1>
              <p className="small" style={{ margin: '12px 0 0' }}>
                {d.vehicle.nickname ? `${d.vehicle.nickname}. ` : ''}{headLine}VIN <span className="vin">{d.vehicle.vin}</span>
              </p>
              {d.vehicle.flags.map((f) => <p key={f} className="small" style={{ margin: '6px 0 0' }}>{flagText(f)}</p>)}
            </>
          ) : (
            <>
              <Skeleton w="70%" h={40} style={{ marginTop: 8 }} />
              <Skeleton w="90%" h={18} style={{ marginTop: 12 }} />
            </>
          )}
        </div>
        <div>{d ? <VehiclePhoto car={{ year: Number(d.vehicle.label.slice(0, 4)) || undefined, make: d.vehicle.label.split(' ')[1], model: d.vehicle.label.split(' ').slice(2).join(' ') }} /> : <Skeleton h={180} />}</div>
      </div>
      <VehicleTabs id={id} on="overview" />

      <div className="sheet g4" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        <div className="cell">
          <p className="label">Private value</p>
          {d ? (
            <>
              <p className="mono" style={{ ...statBig, color: 'var(--blue)' }}>{d.privateValue != null ? usd(d.privateValue) : '–'}</p>
              <p className="small" style={statSub}>
                {d.changeSinceLast
                  ? d.changeSinceLast.amount === 0
                    ? `No change since ${shortDate(d.changeSinceLast.sinceDate)}`
                    : `${usdSigned(d.changeSinceLast.amount)} since ${shortDate(d.changeSinceLast.sinceDate)}`
                  : d.lastAppraisedAt ? `appraised ${shortDate(d.lastAppraisedAt)}` : 'not appraised yet'}
              </p>
            </>
          ) : <StatSkel />}
        </div>
        <div className="cell">
          <p className="label">Since purchase</p>
          {d ? (
            d.sincePurchase ? (
              <>
                <p className="mono" style={statBig}>{usdSigned(d.sincePurchase.amount)}</p>
                <p className="small" style={statSub}>bought for {usd(d.sincePurchase.purchasePrice)}</p>
              </>
            ) : (
              <>
                <p className="mono" style={statBig}>–</p>
                <p className="small" style={statSub}>{d.privateValue == null ? 'needs a current value' : 'purchase price not on file'}</p>
              </>
            )
          ) : <StatSkel />}
        </div>
        <div className="cell">
          <p className="label">Next service</p>
          {d ? (
            d.nextService ? (
              <>
                <p className="mono" style={{ ...statBig, ...(d.nextService.overdue ? { fontWeight: 600 } : {}) }}>{shortDate(d.nextService.date)}</p>
                <p className="small" style={statSub}>{d.nextService.title}, {d.nextService.statusText}</p>
              </>
            ) : (
              <>
                <p className="mono" style={statBig}>–</p>
                <p className="small" style={statSub}>nothing scheduled</p>
              </>
            )
          ) : <StatSkel />}
        </div>
        <div className="cell">
          <p className="label">Open recalls</p>
          {d ? (
            d.openRecalls ? (
              <>
                <p className="mono" style={statBig}>{d.openRecalls.count}</p>
                <p className="small" style={statSub}>
                  {d.openRecalls.count === 0 ? 'none found for your model year' : `may apply to your model year; confirm by VIN at `}
                  {d.openRecalls.count > 0 && <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">nhtsa.gov/recalls</a>}
                  {`. Checked ${shortDate(d.openRecalls.checkedAt)}.`}
                </p>
              </>
            ) : (
              <>
                <p className="mono" style={statBig}>–</p>
                <p className="small" style={statSub}>not checked yet; we check NHTSA weekly</p>
              </>
            )
          ) : <StatSkel />}
        </div>
      </div>

      <div className="g2" style={{ marginTop: 48, alignItems: 'start', gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 20px' }}>History</h2>
          {!d && <Skeleton h={300} />}
          {d && d.timeline.length === 0 && <p className="small" style={{ margin: 0 }}>No history yet. Appraisals and services you log show up here.</p>}
          {d && d.timeline.length > 0 && (
            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {d.timeline.map((t, i) => {
                const slug = t.kind === 'appraisal' && t.id ? slugs.get(t.id) : undefined;
                return (
                  <li key={`${t.kind}-${t.id ?? i}`} style={{ display: 'grid', gridTemplateColumns: '120px 18px 1fr', gap: 14, alignItems: 'start' }}>
                    <span className="mono small" style={{ paddingTop: 2 }}>{longDate(t.date)}</span>
                    <span aria-hidden="true" style={{ width: 11, height: 11, border: '2px solid var(--blue)', borderRadius: '50%', marginTop: 4, background: 'var(--fill)' }} />
                    <div style={{ paddingBottom: 22, borderBottom: '1px solid var(--line)', minWidth: 0 }}>
                      {slug
                        ? <Link href={`/report/${slug}`} style={{ color: 'var(--ink)', fontWeight: 500 }}>{t.title}</Link>
                        : <span style={{ fontWeight: 500 }}>{t.title}</span>}
                      {t.detail && <p className="small" style={{ margin: '4px 0 0' }}>{t.detail}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
          <div className="sheet" style={{ padding: 22 }}>
            <h2 style={sheetLabel}>Quick actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <button type="button" className="btn" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? 'Refreshing value' : 'Refresh value'}</button>
              <Link className="btn-o" href={`/garage/maintenance?vehicle=${id}`}>Log a service</Link>
              <Link className="btn-o" href={`/garage/${id}/sell`}>Plan a sale or trade</Link>
            </div>
            {refreshErr && <p className="err" role="alert" style={{ marginTop: 12 }}>{refreshErr.message}</p>}
            {refreshed && <p className="small" role="status" style={{ margin: '12px 0 0', color: 'var(--ink)' }}>{refreshed}</p>}
          </div>

          <SaleOutcomePrompts vehicleId={id} />
          <VehicleSaleActions vehicleId={id} />
          <OdometerForm id={id} current={d?.vehicle.odometer ?? null} today={today} onSaved={() => void ov.reload()} />

          <Documents id={id} summary={d?.documents ?? null} docs={docs.data?.documents ?? null} docsError={docs.error} today={today}
            onChanged={() => { void docs.reload(); void ov.reload(); }} reloadDocs={docs.reload} />

          <div className="sheet" style={{ padding: 22 }}>
            <h2 style={sheetLabel}>Specs from the VIN</h2>
            {!s ? <Skeleton h={120} style={{ marginTop: 14 }} /> : (
              <dl className="mono" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13, margin: '14px 0 0' }}>
                {([
                  ['Engine', s.engine], ['Drive', s.drive], ['Body', s.doors ? `${s.doors}-door ${(s.body ?? '').toLowerCase()}`.trim() : s.body],
                  ['Fuel', s.fuel], ['Trim', s.trim.text],
                  ...(s.trim.confirmed && s.trim.decoded && s.trim.decoded !== s.trim.value ? [['Decoded trim', s.trim.decoded]] : []),
                  ['Plant', s.plant],
                ] as [string, string | null][]).map(([k, v]) => (
                  <Row key={k} k={k} v={v ?? 'Not in the decode'} />
                ))}
              </dl>
            )}
          </div>

          {d && d.reported.length > 0 && (
            <div className="sheet" style={{ padding: 22 }}>
              <h2 style={sheetLabel}>You reported</h2>
              <p className="small" style={{ margin: '6px 0 0' }}>From your latest appraisal. We cannot verify these.</p>
              <dl className="mono" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13, margin: '14px 0 0' }}>
                {d.reported.map((r) => <Row key={r.key} k={REPORTED_KEYS[r.key] ?? r.key} v={reportedValue(r.key, r.value)} />)}
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={{ color: 'var(--mid)' }}>{k}</dt>
      <dd style={{ margin: 0 }}>{v}</dd>
    </>
  );
}

function StatSkel() {
  return (
    <>
      <Skeleton w={110} h={31} style={{ marginTop: 6 }} />
      <Skeleton w={140} h={16} style={{ marginTop: 4 }} />
    </>
  );
}

/* --------------------------------------------------------------- odometer */

function OdometerForm({ id, current, today, onSaved }: { id: string; current: number | null; today: string | null; onSaved: () => void }) {
  const [milesIn, setMilesIn] = useState('');
  const [on, setOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  useEffect(() => { if (today && !on) setOn(today); }, [today, on]);

  async function save() {
    setFields({});
    setErr(null);
    setSaved('');
    const t = milesIn.replace(/[,\s]/g, '');
    if (!/^\d+$/.test(t)) { setFields({ miles: ['Enter whole miles, like 39100.'] }); return; }
    const date = on || today || localToday();
    setBusy(true);
    try {
      const r = await api<{ odometer: number }>(`/api/vehicles/${id}/odometer`, { body: { miles: Number(t), on: date } });
      setSaved(`Odometer updated to ${miles(r.odometer)}`);
      setMilesIn('');
      onSaved();
    } catch (e) {
      const ae = asApiError(e);
      const hasField = !!(ae.fields.miles || ae.fields.on);
      if (hasField) setFields({ miles: ae.fields.miles ?? [], on: ae.fields.on ?? [] });
      // Skip the form-level line when a field error already says it.
      setErr(hasField && (ae.code === 'invalid_input' || [...(ae.fields.miles ?? []), ...(ae.fields.on ?? [])].includes(ae.message)) ? null : ae.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2 style={sheetLabel}>Update odometer</h2>
      <div className="g2" style={{ gap: 12 }}>
        <Field label="Miles" hint={current != null ? `Last reading ${miles(current)}` : undefined} errors={fields.miles?.length ? fields.miles : undefined}>
          {({ id: fid, describedBy, invalid }) => <input id={fid} className="inp mono" inputMode="numeric" value={milesIn} onChange={(e) => setMilesIn(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <Field label="Date" errors={fields.on?.length ? fields.on : undefined}>
          {({ id: fid, describedBy, invalid }) => <input id={fid} type="date" className="inp mono" value={on} max={today ?? undefined} onChange={(e) => setOn(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
      </div>
      <button type="submit" className="btn-o" disabled={busy}>{busy ? 'Saving' : 'Save reading'}</button>
      {err && <p className="err" role="alert">{err}</p>}
      {saved && <p className="small" role="status" style={{ margin: 0, color: 'var(--ink)' }}>{saved}</p>}
    </form>
  );
}

/* -------------------------------------------------------------- documents */

function Documents({ id, summary, docs, docsError, today, onChanged, reloadDocs }: {
  id: string; summary: Overview['documents'] | null; docs: Doc[] | null; docsError: ApiError | null; today: string | null;
  onChanged: () => void; reloadDocs: () => void;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map((docs ?? []).map((x) => [x.id, x]));
  const rows: { name: string; text: string; docId: string | null }[] = summary
    ? [
        { name: 'Title', text: summary.title.text, docId: summary.title.documentId },
        { name: 'Registration', text: summary.registration.text, docId: summary.registration.documentId },
        { name: 'Insurance card', text: summary.insurance.text, docId: summary.insurance.documentId },
        { name: 'Service receipts', text: summary.receipts.text, docId: null },
      ]
    : [];
  const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'var(--ink)' };

  return (
    <div className="sheet" style={{ padding: 22 }}>
      <h2 style={sheetLabel}>Documents</h2>
      {!summary && <Skeleton h={200} style={{ marginTop: 14 }} />}
      {rows.map((r) => {
        const url = r.docId ? byId.get(r.docId)?.downloadUrl : null;
        const inner = <><span>{r.name}</span><span className="small" style={{ textAlign: 'right' }}>{r.text}</span></>;
        return url
          ? <a key={r.name} href={url} style={rowStyle}>{inner}</a>
          : <div key={r.name} style={rowStyle}>{inner}</div>;
      })}

      {docs && docs.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>All documents ({docs.length})</summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {docs.map((x) => <DocRow key={x.id} doc={x} onRemoved={onChanged} />)}
          </ul>
        </details>
      )}
      {docsError && <div style={{ marginTop: 12 }}><ErrorNote error={docsError} onRetry={reloadDocs} /></div>}

      {open
        ? <UploadForm id={id} onDone={() => { setOpen(false); onChanged(); }} onCancel={() => setOpen(false)} />
        : <button type="button" className="btn-o" style={{ marginTop: 16, width: '100%' }} onClick={() => setOpen(true)}>Upload a document</button>}
    </div>
  );
}

function DocRow({ doc, onRemoved }: { doc: Doc; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const name = doc.label || kindLabel(doc.kind);
  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/documents/${doc.id}`, { method: 'DELETE' });
      onRemoved();
    } catch (e) {
      setErr(asApiError(e).message);
      setBusy(false);
    }
  }
  return (
    <li style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>
          {doc.downloadUrl ? <a href={doc.downloadUrl}>{name}</a> : name}
          <span className="small">{doc.label ? `, ${kindLabel(doc.kind)}` : ''}{doc.expiresOn ? `, expires ${longDate(doc.expiresOn)}` : ''}{doc.hasFile ? '' : ', no file'}</span>
        </span>
        {!confirm && <button type="button" className="ghost" onClick={() => setConfirm(true)} aria-label={`Remove ${name}`}>Remove</button>}
      </div>
      {confirm && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="small">Remove {name}{doc.hasFile ? ' and its file' : ''}? This cannot be undone.</span>
          <button type="button" className="btn-o" onClick={remove} disabled={busy}>{busy ? 'Removing' : 'Yes, remove'}</button>
          <button type="button" className="ghost" onClick={() => setConfirm(false)}>Keep it</button>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </li>
  );
}

function UploadForm({ id, onDone, onCancel }: { id: string; onDone: () => void; onCancel: () => void }) {
  const [kind, setKind] = useState('registration');
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    setFields({});
    setErr(null);
    const file = fileRef.current?.files?.[0] ?? null;
    try {
      if (file) {
        const form = new FormData();
        form.set('kind', kind);
        if (label.trim()) form.set('label', label.trim());
        if (expires) form.set('expiresOn', expires);
        form.set('file', file);
        await postForm(`/api/vehicles/${id}/documents`, form);
      } else {
        await api(`/api/vehicles/${id}/documents`, { body: { kind, label: label.trim() || null, expiresOn: expires || null } });
      }
      onDone();
    } catch (e) {
      const ae = asApiError(e);
      setFields(ae.fields);
      const fieldMsgs = Object.values(ae.fields).flat();
      const allShown = Object.keys(ae.fields).every((k) => ['kind', 'label', 'expiresOn', 'file'].includes(k));
      setErr(fieldMsgs.length && allShown && (ae.code === 'invalid_input' || fieldMsgs.includes(ae.message)) ? null : ae.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      <Field label="Type" errors={fields.kind}>
        {({ id: fid }) => (
          <select id={fid} className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        )}
      </Field>
      <Field label="Name (optional)" errors={fields.label}>
        {({ id: fid }) => <input id={fid} className="inp" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />}
      </Field>
      <Field label="Expires or renews (optional)" hint="We remind you 30 days before." errors={fields.expiresOn}>
        {({ id: fid, describedBy }) => <input id={fid} type="date" className="inp mono" value={expires} onChange={(e) => setExpires(e.target.value)} aria-describedby={describedBy} />}
      </Field>
      <Field label="File (optional)" hint="PDF, JPEG, PNG, HEIC or WebP, up to 10 MB. Without a file we save the record only." errors={fields.file}>
        {({ id: fid, describedBy }) => <input id={fid} ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp" aria-describedby={describedBy} style={{ minHeight: 44 }} />}
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving' : 'Save document'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
