'use client';
/**
 * /garage/[vehicleId], ported from design/Vehicle.dc.html.
 * Data: GET /api/vehicles/:id/overview, /api/vehicles/:id/documents, /api/appraisals?vehicleId (report links),
 * /api/maintenance/upcoming?vehicleId (the server's date). Actions: odometer, refresh value, documents.
 */
import Link from 'next/link';
import { SaleOutcomePrompts, VehicleSaleActions } from './SaleOutcomeCard';
import { notFound } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CarDrawing } from '@/views/components/CarDrawing';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { ErrorNote, Field, Skeleton } from '@/views/components/ui';
import { api, useApi, type ApiError } from '@/views/components/client/api';
import { longDate, miles, num, shortDate, usd, usdSigned } from '@/views/components/client/format';
import { VehicleTabs, asApiError, carVariant, flagText, localToday, postForm, type NextService } from './shared';

import styles from './garage.module.css';

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
      <section className={`wrap page ${styles.page}`}>
        <Link href="/garage" className={`small ${styles.back}`}>← Garage</Link>
        <div style={{ marginTop: 'var(--s5)' }}><ErrorNote error={ov.error} onRetry={ov.reload} /></div>
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
    <section className={`wrap page ${styles.page}`}>
      <header className={`g2 ${styles.columns} ${styles.hero}`}>
        <div className={styles.group}>
          <Link href="/garage" className={`small ${styles.back}`}>← Garage</Link>
          {d ? (
            <>
              <h1 className="title">{d.vehicle.label}</h1>
              <p className="small">
                {d.vehicle.nickname ? `${d.vehicle.nickname}. ` : ''}{headLine}VIN <span className="vin">{d.vehicle.vin}</span>
              </p>
              {d.vehicle.flags.map((f) => <p key={f} className="small">{flagText(f)}</p>)}
            </>
          ) : (
            <>
              <Skeleton w="70%" h={40} />
              <Skeleton w="90%" h={18} />
            </>
          )}
        </div>
        <div className={styles.art}>
          {d ? (
            <VehiclePhoto
              car={{ year: Number(d.vehicle.label.slice(0, 4)) || undefined, make: d.vehicle.label.split(' ')[1], model: d.vehicle.label.split(' ').slice(2).join(' ') }}
              fallback={
                <CarDrawing
                  variant={carVariant(d.vehicle.label, s?.body)}
                  label={`${d.vehicle.label}, line drawing (no photo found)`}
                  ink={false}
                />
              }
            />
          ) : <Skeleton h={180} />}
        </div>
      </header>
      <VehicleTabs id={id} on="overview" />

      <div className={`stats ${styles.section}`}>
        <div>
          <p className="kicker">Private value</p>
          {d ? (
            <>
              <p className="stat-v accent">{d.privateValue != null ? usd(d.privateValue) : '–'}</p>
              <p className="small">
                {d.changeSinceLast
                  ? d.changeSinceLast.amount === 0
                    ? `No change since ${shortDate(d.changeSinceLast.sinceDate)}`
                    : `${usdSigned(d.changeSinceLast.amount)} since ${shortDate(d.changeSinceLast.sinceDate)}`
                  : d.lastAppraisedAt ? `appraised ${shortDate(d.lastAppraisedAt)}` : 'not appraised yet'}
              </p>
            </>
          ) : <StatSkel />}
        </div>
        <div>
          <p className="kicker">Since purchase</p>
          {d ? (
            d.sincePurchase ? (
              <>
                <p className="stat-v">{usdSigned(d.sincePurchase.amount)}</p>
                <p className="small">bought for {usd(d.sincePurchase.purchasePrice)}</p>
              </>
            ) : (
              <>
                <p className="stat-v">–</p>
                <p className="small">{d.privateValue == null ? 'needs a current value' : 'purchase price not on file'}</p>
              </>
            )
          ) : <StatSkel />}
        </div>
        <div>
          <p className="kicker">Next service</p>
          {d ? (
            d.nextService ? (
              <>
                <p className={d.nextService.overdue ? `stat-v ${styles.overdue}` : 'stat-v'}>{shortDate(d.nextService.date)}</p>
                <p className="small">{d.nextService.title}, {d.nextService.statusText}</p>
              </>
            ) : (
              <>
                <p className="stat-v">–</p>
                <p className="small">nothing scheduled</p>
              </>
            )
          ) : <StatSkel />}
        </div>
        <div>
          <p className="kicker">Open recalls</p>
          {d ? (
            d.openRecalls ? (
              <>
                <p className="stat-v">{d.openRecalls.count}</p>
                <p className="small">
                  {d.openRecalls.count === 0 ? 'none found for your model year' : `may apply to your model year; confirm by VIN at `}
                  {d.openRecalls.count > 0 && <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">nhtsa.gov/recalls</a>}
                  {`. Checked ${shortDate(d.openRecalls.checkedAt)}.`}
                </p>
              </>
            ) : (
              <>
                <p className="stat-v">–</p>
                <p className="small">not checked yet; we check NHTSA weekly</p>
              </>
            )
          ) : <StatSkel />}
        </div>
      </div>

      <div className={`g2 ${styles.columns} ${styles.section}`}>
        <section className={`sheet ${styles.group}`}>
          <h2 className="h3">History</h2>
          {!d && <Skeleton h={300} />}
          {d && d.timeline.length === 0 && <p className="small" style={{ margin: 0 }}>No history yet.</p>}
          {d && d.timeline.length > 0 && (
            <ol className={`${styles.list} ${styles.timeline}`}>
              {d.timeline.map((t, i) => {
                const slug = t.kind === 'appraisal' && t.id ? slugs.get(t.id) : undefined;
                return (
                  <li key={`${t.kind}-${t.id ?? i}`}>
                    <time className="small" dateTime={t.date.slice(0, 10)}>{longDate(t.date)}</time>
                    <span className={styles.marker} aria-hidden="true" />
                    <div>
                      {slug ? <Link href={`/report/${slug}`}>{t.title}</Link> : t.title}
                      {t.detail && <p className="small">{t.detail}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className={styles.groups}>
          <section className={`sheet ${styles.group}`}>
            <h2 className="h3">Actions</h2>
            <div className="row">
              <button type="button" className="btn" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? 'Refreshing value' : 'Refresh value'}</button>
              <Link className="btn-o" href={`/garage/maintenance?vehicle=${id}`} aria-label="Log a service">Log service</Link>
              <Link className="btn-o" href={`/garage/${id}/sell`} aria-label="Plan a sale or trade">Plan sale</Link>
            </div>
            {refreshErr && <p className="err" role="alert">{refreshErr.message}</p>}
            {refreshed && <p className="small" role="status">{refreshed}</p>}
            <VehicleSaleActions vehicleId={id} />
          </section>

          <SaleOutcomePrompts vehicleId={id} />
          <OdometerForm id={id} current={d?.vehicle.odometer ?? null} today={today} onSaved={() => void ov.reload()} />

          <Documents id={id} summary={d?.documents ?? null} docs={docs.data?.documents ?? null} docsError={docs.error} today={today}
            onChanged={() => { void docs.reload(); void ov.reload(); }} reloadDocs={docs.reload} />

          <section className={`sheet ${styles.group}`}>
            <h2 className="h3">Specs from the VIN</h2>
            {!s ? <Skeleton h={120} /> : (
              <dl className="kv">
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
          </section>

          {d && d.reported.length > 0 && (
            <section className={`sheet ${styles.group}`}>
              <h2 className="h3">You reported</h2>
              <p className="small">Unverified answers from your latest appraisal.</p>
              <dl className="kv">
                {d.reported.map((r) => <Row key={r.key} k={REPORTED_KEYS[r.key] ?? r.key} v={reportedValue(r.key, r.value)} />)}
              </dl>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

function StatSkel() {
  return (
    <>
      <Skeleton w={110} h={31} style={{ marginTop: 'var(--s2)' }} />
      <Skeleton w={140} h={16} style={{ marginTop: 'var(--s1)' }} />
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
    <form className={`sheet ${styles.group}`} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate>
      <h2 className="h3">Update odometer</h2>
      <div className={styles.fields}>
        <Field label="Miles" hint={current != null ? `Last reading ${miles(current)}` : undefined} errors={fields.miles?.length ? fields.miles : undefined}>
          {({ id: fid, describedBy, invalid }) => <input id={fid} className="inp" inputMode="numeric" value={milesIn} onChange={(e) => setMilesIn(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
        </Field>
        <Field label="Date" errors={fields.on?.length ? fields.on : undefined}>
          {({ id: fid, describedBy, invalid }) => <input id={fid} type="date" className="inp" value={on} max={today ?? undefined} onChange={(e) => setOn(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
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
  return (
    <section className={`sheet ${styles.group}`}>
      <h2 className="h3">Documents</h2>
      {!summary && <Skeleton h={200} />}
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((r) => {
            const url = r.docId ? byId.get(r.docId)?.downloadUrl : null;
            return (
              <li key={r.name} className={styles.document}>
                {url ? <a href={url} aria-label={`${r.name} ${r.text}`}>{r.name}</a> : <span>{r.name}</span>}
                <span className="small">{r.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {docs && docs.length > 0 && (
        <details className={styles.details}>
          <summary>All documents ({docs.length})</summary>
          <ul className={styles.list}>
            {docs.map((x) => <DocRow key={x.id} doc={x} onRemoved={onChanged} />)}
          </ul>
        </details>
      )}
      {docsError && <ErrorNote error={docsError} onRetry={reloadDocs} />}

      {open
        ? <UploadForm id={id} onDone={() => { setOpen(false); onChanged(); }} onCancel={() => setOpen(false)} />
        : <button type="button" className="btn-o" onClick={() => setOpen(true)}>Upload a document</button>}
    </section>
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
    <li className={styles.group}>
      <div className={styles.document}>
        <span>
          {doc.downloadUrl ? <a href={doc.downloadUrl}>{name}</a> : name}
          <span className="small">{doc.label ? `, ${kindLabel(doc.kind)}` : ''}{doc.expiresOn ? `, expires ${longDate(doc.expiresOn)}` : ''}{doc.hasFile ? '' : ', no file'}</span>
        </span>
        {!confirm && <button type="button" className="textbtn" onClick={() => setConfirm(true)} aria-label={`Remove ${name}`}>Remove</button>}
      </div>
      {confirm && (
        <div className="row">
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
    <form className={styles.group} onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
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
        {({ id: fid, describedBy }) => <input id={fid} type="date" className="inp" value={expires} onChange={(e) => setExpires(e.target.value)} aria-describedby={describedBy} />}
      </Field>
      <Field label="File (optional)" hint="PDF, JPEG, PNG, HEIC or WebP, up to 10 MB." errors={fields.file}>
        {({ id: fid, describedBy }) => <input id={fid} ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp" aria-describedby={describedBy} className={styles.file} />}
      </Field>
      <div className="row">
        <button type="submit" className="btn-o" disabled={busy}>{busy ? 'Saving' : 'Save document'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
