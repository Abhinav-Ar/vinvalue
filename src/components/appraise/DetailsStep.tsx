'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type FieldErrors } from '@/lib/client/api';
import { EmptyState, ErrorNote, Field, SegmentedControl, Select, Skeleton, Stepper } from '@/components/ui';
import { CarDrawing } from '@/components/CarDrawing';
import { carVariant, countWord, loadDecode, specLine, WARNING_TEXT, type StoredDecode } from './session';

type Condition = 'excellent' | 'good' | 'fair' | 'rough';
type Title = 'clean' | 'rebuilt' | 'salvage';
type Accidents = 'none' | 'minor' | 'major';

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'rough', label: 'Rough' },
];
const TITLES: { value: Title; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'rebuilt', label: 'Rebuilt' },
  { value: 'salvage', label: 'Salvage' },
];
const ACCIDENTS: { value: Accidents; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];
const COND_NOTE: Record<Condition, string> = {
  excellent: 'Like new. No dings, clean interior, all service done.',
  good: 'Normal wear for its age. Minor marks, nothing needs fixing.',
  fair: 'Visible wear or a few things that need attention soon.',
  rough: 'Needs real work before most buyers would consider it.',
};
const NOT_SURE = { value: '', label: 'Not sure' };
const SERVICE = [NOT_SURE, { value: 'full', label: 'Full records' }, { value: 'partial', label: 'Partial' }, { value: 'none', label: 'None' }];
const OWNERS = [NOT_SURE, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3 or more' }];
const KEYS = [NOT_SURE, { value: 'two', label: 'Both sets' }, { value: 'one', label: 'One set' }];
const LIGHTS = [NOT_SURE, { value: 'none', label: 'None' }, { value: 'check_engine', label: 'Check engine' }, { value: 'other', label: 'Other' }];

/** Field order on the page, used to focus the first invalid one. */
const ORDER = ['confirm', 'trim', 'mileage', 'zip', 'condition', 'title', 'accidents', 'serviceHistory', 'owners', 'keys', 'warningLights'] as const;
const FOCUS: Record<string, string> = {
  confirm: '#confirm', trim: '#trim-text, input[name="trim"]', mileage: '#mi', zip: '#zip',
  condition: 'input[name="condition"]', title: 'input[name="title"]', accidents: 'input[name="accidents"]',
  serviceHistory: '#svc', owners: '#own', keys: '#keys', warningLights: '#warn',
};
const OPTIONAL = new Set(['serviceHistory', 'owners', 'keys', 'warningLights']);

const minutes = (sec: unknown) => Math.max(1, Math.ceil((typeof sec === 'number' ? sec : 60) / 60));
const labelOf = <T extends string>(opts: { value: T; label: string }[], v: T) => opts.find((o) => o.value === v)?.label ?? v;

/** /appraise/details: step 2, the details that change the value. */
export function DetailsStep() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredDecode | null | undefined>(undefined);
  const [trims, setTrims] = useState<string[]>([]);
  const [trim, setTrim] = useState<string | null>(null);
  const [trimConfirmed, setTrimConfirmed] = useState(false);
  const [trimText, setTrimText] = useState('');
  const [detailsOk, setDetailsOk] = useState(false);
  const [mileage, setMileage] = useState('');
  const [zip, setZip] = useState('');
  const [condition, setCondition] = useState<Condition>('good');
  const [title, setTitle] = useState<Title>('clean');
  const [accidents, setAccidents] = useState<Accidents>('none');
  const [serviceHistory, setServiceHistory] = useState('');
  const [owners, setOwners] = useState('');
  const [keys, setKeys] = useState('');
  const [warningLights, setWarningLights] = useState('');
  const [refineOpen, setRefineOpen] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = loadDecode();
    setStored(s);
    if (s) setTrims(s.decode.trimCandidates);
  }, []);

  function focusFirst(f: FieldErrors) {
    const first = ORDER.find((k) => f[k]?.length);
    if (!first) return;
    if (OPTIONAL.has(first)) setRefineOpen(true);
    requestAnimationFrame(() => (document.querySelector(FOCUS[first]!) as HTMLElement | null)?.focus());
  }

  function validate(): FieldErrors {
    const f: FieldErrors = {};
    if (stored?.decode.needsConfirmation && !detailsOk) f.confirm = ['Confirm the year, make and model, or go back and check the VIN.'];
    if (trims.length > 1 && !trim) f.trim = ['Choose your trim. The VIN alone does not tell us which one it is.'];
    const mi = mileage.replace(/[,\s]/g, '');
    if (!mi) f.mileage = ['Enter the current mileage from the odometer.'];
    else if (!/^\d+$/.test(mi)) f.mileage = ['Enter the mileage as a whole number, like 42,000.'];
    else if (Number(mi) > 999_999) f.mileage = ['Mileage must be under 1,000,000.'];
    if (!/^\d{5}$/.test(zip.trim())) f.zip = ['Enter a 5-digit US ZIP code.'];
    return f;
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!stored) return;
    setError(null);
    const f = validate();
    setFields(f);
    if (Object.keys(f).length) {
      focusFirst(f);
      return;
    }
    const chosenTrim = trims.length > 1 ? trim : trims.length === 1 ? (trimConfirmed ? trims[0]! : null) : trimText.trim() || null;
    setBusy(true);
    try {
      const report = await api<{ slug: string }>('/api/appraisals', {
        body: {
          vin: stored.decode.vin,
          trim: chosenTrim,
          mileage: mileage.replace(/[,\s]/g, ''),
          zip: zip.trim(),
          condition,
          title,
          accidents,
          serviceHistory: serviceHistory || null,
          owners: owners ? Number(owners) : null,
          keys: keys || null,
          warningLights: warningLights || null,
          importedVehicle: stored.importedVehicle || undefined,
        },
      });
      router.push(`/report/${report.slug}`);
    } catch (err) {
      const ae = err instanceof ApiError ? err : new ApiError(0, 'internal', 'Something went wrong on our side. Try again.');
      const cands = ae.details.trimCandidates;
      if (Array.isArray(cands) && cands.length) {
        setTrims(cands.map(String));
        setTrim(null);
      }
      if (Object.keys(ae.fields).length) {
        setFields(ae.fields);
        focusFirst(ae.fields);
        if (ae.fields.vin?.length) setError(ae);
      } else {
        setError(ae);
      }
      setBusy(false);
    }
  }

  if (stored === undefined) return <DetailsSkeleton />;
  if (stored === null) {
    return (
      <>
        <Stepper step={2} />
        <section className="wrap page">
          <EmptyState
            text="Enter your VIN first so we know which car to value."
            action={<Link className="btn" href="/appraise">Enter a VIN</Link>}
          />
        </section>
      </>
    );
  }

  const d = stored.decode;
  const warnings = d.warnings.map((w) => WARNING_TEXT[w]).filter(Boolean) as string[];
  const line = specLine(d.specs);
  const trimSummary = trims.length > 1 ? trim ?? 'Not picked yet' : trims.length === 1 ? (trimConfirmed ? trims[0]! : `${trims[0]} (from the VIN)`) : trimText.trim() || 'Not given';

  return (
    <>
      <Stepper step={2} />
      <section className="wrap g2" style={{ paddingTop: 64, paddingBottom: 96, gridTemplateColumns: '7fr 5fr', alignItems: 'start' }}>
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div className="sheet" style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h1 className="title" style={{ margin: '0 0 6px' }}>{d.year} {d.make} {d.model}</h1>
              <p className="small" style={{ margin: 0 }}>
                {line ? `${line} ` : ''}VIN <span className="vin">{d.vin}</span>
              </p>
            </div>
            <Link href="/appraise" className="small" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Use a different VIN</Link>
          </div>

          {warnings.length > 0 && (
            <div className="notice">
              {warnings.map((w) => <p key={w} style={{ margin: 0 }}>{w}</p>)}
            </div>
          )}

          {d.needsConfirmation && (
            <div className="field">
              <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: 15 }}>
                <input
                  id="confirm"
                  type="checkbox"
                  checked={detailsOk}
                  onChange={(e) => setDetailsOk(e.target.checked)}
                  aria-invalid={!!fields.confirm || undefined}
                  aria-describedby={fields.confirm ? 'confirm-err' : undefined}
                  style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: 0 }}
                />
                The year, make and model above match my car
              </label>
              <Errs id="confirm-err" errors={fields.confirm} />
            </div>
          )}

          {trims.length > 1 && (
            <Group label={`Trim (your VIN matches ${countWord(trims.length)})`} errId="trim-err" errors={fields.trim}>
              <SegmentedControl
                name="trim"
                label={`Trim, your VIN matches ${trims.length}`}
                value={trim}
                onChange={(v) => { setTrim(v); clear('trim'); }}
                options={trims.map((t) => ({ value: t, label: t }))}
              />
            </Group>
          )}
          {trims.length === 1 && (
            <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: 15 }}>
              <input
                type="checkbox"
                checked={trimConfirmed}
                onChange={(e) => setTrimConfirmed(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--blue)', margin: 0 }}
              />
              <span>
                My car is the {trims[0]} trim <span className="small">(optional; confirming it narrows the range)</span>
              </span>
            </label>
          )}
          {trims.length === 0 && (
            <Field id="trim-text" label={<>Trim <span className="small">(optional)</span></>} hint="As written on the car or the title, for example GT Premium." errors={fields.trim}>
              {({ id, describedBy, invalid }) => (
                <input id={id} className="inp" value={trimText} maxLength={60} onChange={(e) => setTrimText(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
              )}
            </Field>
          )}

          <div className="g2" style={{ gap: 20 }}>
            <Field id="mi" label="Current mileage *" errors={fields.mileage}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  className="inp mono"
                  inputMode="numeric"
                  placeholder="e.g. 42,000"
                  autoComplete="off"
                  aria-required="true"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={mileage}
                  onChange={(e) => { setMileage(e.target.value.replace(/[^\d,]/g, '')); clear('mileage'); }}
                />
              )}
            </Field>
            <Field id="zip" label="ZIP code *" hint="Where the car is now." errors={fields.zip}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  className="inp mono"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="5 digits"
                  autoComplete="postal-code"
                  aria-required="true"
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={zip}
                  onChange={(e) => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); clear('zip'); }}
                />
              )}
            </Field>
          </div>

          <div>
            <Group label="Overall condition" errId="condition-err" errors={fields.condition}>
              <SegmentedControl name="condition" label="Overall condition" value={condition} onChange={setCondition} options={CONDITIONS} />
            </Group>
            <p className="small" style={{ margin: '12px 0 0' }}>{COND_NOTE[condition]}</p>
          </div>

          <div className="g2" style={{ gap: 20 }}>
            <Group label="Title" errId="title-err" errors={fields.title}>
              <SegmentedControl name="title" label="Title" value={title} onChange={setTitle} options={TITLES} />
            </Group>
            <Group label="Accident history" errId="accidents-err" errors={fields.accidents}>
              <SegmentedControl name="accidents" label="Accident history" value={accidents} onChange={setAccidents} options={ACCIDENTS} />
            </Group>
          </div>

          <details className="sheet" style={{ padding: '20px 24px' }} open={refineOpen} onToggle={(e) => setRefineOpen((e.target as HTMLDetailsElement).open)}>
            <summary style={{ cursor: 'pointer', fontWeight: 500, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
              Refine the estimate <span className="small">(optional)</span>
            </summary>
            <div className="g2" style={{ gap: 20, marginTop: 20 }}>
              <Field id="svc" label="Service history" errors={fields.serviceHistory}>
                {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={serviceHistory} onChange={setServiceHistory} options={SERVICE} />}
              </Field>
              <Field id="own" label="Owners" errors={fields.owners}>
                {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={owners} onChange={setOwners} options={OWNERS} />}
              </Field>
              <Field id="keys" label="Keys" errors={fields.keys}>
                {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={keys} onChange={setKeys} options={KEYS} />}
              </Field>
              <Field id="warn" label="Warning lights" errors={fields.warningLights}>
                {({ id, describedBy, invalid }) => <Select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={warningLights} onChange={setWarningLights} options={LIGHTS} />}
              </Field>
            </div>
          </details>

          <SubmitError error={error} zip={zip} onRetry={() => void submit()} />

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={busy}>{busy ? 'Calculating value' : 'Calculate value'}</button>
            <span className="small">Uses live listings within 100 miles of your ZIP.</span>
          </div>
        </form>

        <aside className="sheet" style={{ padding: 28, position: 'sticky', top: 24 }}>
          <h2 className="label" style={{ fontSize: 13 }}>Your inputs</h2>
          <div style={{ margin: '16px 0 12px' }}>
            <CarDrawing variant={carVariant(d.model)} />
          </div>
          <Row k="Trim" v={trimSummary} />
          <Row k="Condition" v={labelOf(CONDITIONS, condition)} />
          <Row k="Title" v={labelOf(TITLES, title)} />
          <Row k="Accidents" v={labelOf(ACCIDENTS, accidents)} />
        </aside>
      </section>
    </>
  );

  function clear(k: string) {
    if (fields[k]) setFields(({ [k]: _drop, ...rest }) => rest);
  }
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
      <span className="label">{k}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  );
}

/** Visible label for a SegmentedControl (its own legend is for screen readers). */
function Group({ label, errId, errors, children }: { label: string; errId: string; errors?: string[]; children: ReactNode }) {
  return (
    <div className="field">
      <p className="label" aria-hidden="true">{label}</p>
      {children}
      <Errs id={errId} errors={errors} />
    </div>
  );
}

function Errs({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return <div id={id} role="alert">{errors.map((e) => <p key={e} className="err">{e}</p>)}</div>;
}

function SubmitError({ error, zip, onRetry }: { error: ApiError | null; zip: string; onRetry: () => void }) {
  if (!error) return null;
  if (error.fields.vin?.length || error.code === 'vin_not_decoded') {
    return (
      <div className="notice" role="alert">
        <p style={{ margin: 0 }}>{error.fields.vin?.[0] ?? 'We could not identify a vehicle from this VIN.'}</p>
        <Link className="btn-o" href="/appraise" style={{ marginTop: 14 }}>Check the VIN</Link>
      </div>
    );
  }
  if (error.code === 'too_few_comps') {
    const found = typeof error.details.compCount === 'number' ? error.details.compCount : 0;
    const need = typeof error.details.minComps === 'number' ? error.details.minComps : null;
    return (
      <div className="notice" role="alert">
        <p style={{ margin: 0 }}>
          We found {found} similar car{found === 1 ? '' : 's'} for sale near {zip || 'your ZIP'}
          {need ? `; we need at least ${need} for a reliable value` : ', which is too few for a reliable value'}.
        </p>
        <p style={{ margin: '8px 0 0' }}>
          We already searched farther out and across nearby model years. Check that the ZIP is where the car is
          and that the trim is right. Rare trims have fewer listings, so leaving the trim unconfirmed can help.
        </p>
      </div>
    );
  }
  if (error.status === 502) {
    return (
      <div className="notice" role="alert">
        <p style={{ margin: 0 }}>The listing service didn&apos;t respond.</p>
        <button type="button" className="btn-o" style={{ marginTop: 14 }} onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (error.status === 429) {
    const n = minutes(error.details.retryAfterSec);
    return (
      <div className="notice" role="alert">
        <p style={{ margin: 0 }}>You have run too many appraisals in a short time. Try again in {n} minute{n === 1 ? '' : 's'}.</p>
      </div>
    );
  }
  return <ErrorNote error={error} onRetry={onRetry} />;
}

function DetailsSkeleton() {
  return (
    <>
      <Stepper step={2} />
      <section className="wrap g2" style={{ paddingTop: 64, paddingBottom: 96, gridTemplateColumns: '7fr 5fr', alignItems: 'start' }} aria-busy="true">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <Skeleton h={112} />
          <div className="g2" style={{ gap: 20 }}><Skeleton h={80} /><Skeleton h={80} /></div>
          <Skeleton h={80} />
          <div className="g2" style={{ gap: 20 }}><Skeleton h={80} /><Skeleton h={80} /></div>
          <Skeleton h={66} />
          <Skeleton w={180} h={48} />
        </div>
        <Skeleton h={420} />
      </section>
    </>
  );
}
