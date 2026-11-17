'use client';
/**
 * Price check (design/Buy): verdict for a car you are considering, saved cars and comparison.
 * The check itself is public; saving and comparing need an account.
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PriceCheckResult } from '@/models/buy/service';
import { api, ApiError, useApi, type FieldErrors } from '@/views/components/client/api';
import { miles, num, usd } from '@/views/components/client/format';
import { EmptyState, ErrorNote, Field, SegmentedControl, Select, Skeleton } from '@/views/components/ui';
import { parseDollars } from './hooks';

type Seller = 'dealer' | 'private';
type SavedCheck = {
  id: string;
  label: string;
  vin: string;
  askingPrice: number;
  mileage: number;
  sellerType: Seller;
  verdict: { verdict: 'below' | 'fair' | 'above'; fairLow: number; fairHigh: number; mid: number; suggestedOffer: number; compCount: number };
  createdAt: string;
};
type CompareRow = { id: string; car: string; miles: number; asking: number; seller: Seller; verdict: string; verdictLabel: string; fairLow: number; fairHigh: number };
type Body = { vin: string; askingPrice: number | null; mileage: number | null; zip: string; sellerType: Seller; trim?: string };

const COMPARE_MAX = 3;
const DRIVE: Record<string, string> = { RWD: 'rear-wheel drive', FWD: 'front-wheel drive', AWD: 'all-wheel drive', '4WD': 'four-wheel drive' };

function decodedLine(v: PriceCheckResult['vehicle']) {
  const name = [v.year, v.make, v.model, v.trim, v.body?.toLowerCase()].filter(Boolean).join(' ');
  const rest = [v.engine, v.drive ? DRIVE[v.drive.toUpperCase()] ?? v.drive : null].filter(Boolean).join(', ');
  return `Decoded as a ${name}${rest ? `, ${rest}` : ''}.`;
}

export function PriceCheck() {
  const vinRef = useRef<HTMLInputElement>(null);
  const [vin, setVin] = useState('');
  const [ask, setAsk] = useState('');
  const [mileage, setMileage] = useState('');
  const [zip, setZip] = useState('');
  const [seller, setSeller] = useState<Seller>('dealer');
  const [trim, setTrim] = useState('');
  const [trimCandidates, setTrimCandidates] = useState<string[]>([]);

  // Prefill ZIP from the first garage car when signed in.
  const garage = useApi<{ vehicles: { zip: string }[] }>('/api/vehicles');
  useEffect(() => {
    const z = garage.data?.vehicles[0]?.zip;
    if (z) setZip((cur) => cur || z);
  }, [garage.data]);

  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [lastBody, setLastBody] = useState<Body | null>(null);
  const [checking, setChecking] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<ApiError | null>(null);

  const body = (): Body => ({
    vin: vin.trim().toUpperCase(),
    askingPrice: parseDollars(ask),
    mileage: parseDollars(mileage),
    zip: zip.trim(),
    sellerType: seller,
    ...(trim ? { trim } : {}),
  });

  async function check(b: Body = body()) {
    setChecking(true);
    setFields({});
    setError(null);
    setSaveState(null);
    try {
      const r = await api<PriceCheckResult>('/api/price-check', { body: b });
      setResult(r);
      setLastBody(b);
      setTrimCandidates([]);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, 'internal', String(e));
      const cands = err.details.trimCandidates as string[] | undefined;
      if (cands?.length) {
        setTrimCandidates(cands);
        setTrim((t) => t || cands[0]!);
      }
      if (Object.keys(err.fields).length) {
        setFields(err.fields);
        const first = ['vin', 'askingPrice', 'mileage', 'zip', 'trim'].find((f) => err.fields[f]);
        if (first) document.getElementById(`pc-${first}`)?.focus();
      } else setError(err);
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  // Seller type changes the fair range, so re-run an existing check when it flips.
  function pickSeller(s: Seller) {
    setSeller(s);
    if (result && lastBody) void check({ ...lastBody, sellerType: s });
  }

  // Saved checks (account only).
  const saved = useApi<{ items: SavedCheck[] }>('/api/buy-checks');
  const [selected, setSelected] = useState<string[] | null>(null);
  const items = useMemo(() => saved.data?.items ?? [], [saved.data]);
  const sel = selected ?? items.slice(0, COMPARE_MAX).map((i) => i.id);
  const selIds = sel.filter((id) => items.some((i) => i.id === id));
  const compare = useApi<{ rows: CompareRow[] }>(selIds.length ? `/api/buy-checks/compare?ids=${selIds.join(',')}` : null);

  const [saveState, setSaveState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!lastBody) return;
    setSaving(true);
    setSaveState(null);
    try {
      const r = await api<{ buyCheck: SavedCheck }>('/api/buy-checks', { body: lastBody });
      await saved.reload();
      setSelected((s) => {
        const cur = s ?? sel;
        return cur.length < COMPARE_MAX ? [...cur, r.buyCheck.id] : cur;
      });
      setSaveState({ ok: true, msg: `Saved ${r.buyCheck.label}. It is in your saved cars below.` });
    } catch (e) {
      const err = e as ApiError;
      setSaveState({ ok: false, msg: err.status === 401 ? 'Sign in to save cars and compare them.' : err.message });
    } finally {
      setSaving(false);
    }
  }

  const [removing, setRemoving] = useState<string | null>(null);
  const [removeErr, setRemoveErr] = useState<ApiError | null>(null);
  async function remove(id: string) {
    setRemoving(id);
    setRemoveErr(null);
    try {
      await api(`/api/buy-checks/${id}`, { method: 'DELETE' });
      setSelected(sel.filter((x) => x !== id));
      await saved.reload();
    } catch (e) {
      setRemoveErr(e as ApiError);
    } finally {
      setRemoving(null);
    }
  }
  function toggle(id: string, on: boolean) {
    setSelected(on ? [...sel, id].slice(0, COMPARE_MAX) : sel.filter((x) => x !== id));
  }

  const r = result;
  let bar: { rx: number; rw: number; mx: number } | null = null;
  if (r) {
    const a0 = Math.min(r.fairRange.low - 3000, r.askingPrice - 1000);
    const a1 = Math.max(r.fairRange.high + 3000, r.askingPrice + 1000);
    const pct = (n: number) => Math.max(0, Math.min(100, ((n - a0) / (a1 - a0)) * 100));
    bar = { rx: pct(r.fairRange.low), rw: pct(r.fairRange.high) - pct(r.fairRange.low), mx: pct(r.askingPrice) };
  }

  const tooFew = error?.code === 'too_few_comps';
  const upstream = error?.status === 502;

  return (
    <section className="wrap page">
      <h1 className="title">Price check</h1>
      <p className="lede" style={{ marginTop: 14, maxWidth: 640 }}>
        Enter the VIN, asking price and mileage of a car you are considering. We compare it with similar cars for sale near you.
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <div className="sheet g4" style={{ marginTop: 32, padding: 24, gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>
          <Field id="pc-vin" label="VIN" errors={fields.vin}>
            {({ id, describedBy, invalid }) => (
              <input
                ref={vinRef}
                id={id}
                className="inp vin"
                value={vin}
                maxLength={17}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(e) => {
                  setVin(e.target.value.toUpperCase());
                  setTrimCandidates([]);
                  setTrim('');
                }}
                style={{ letterSpacing: '.1em' }}
              />
            )}
          </Field>
          <Field id="pc-askingPrice" label="Asking price" errors={fields.askingPrice}>
            {({ id, describedBy, invalid }) => (
              <input id={id} className="inp mono" inputMode="numeric" value={ask} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setAsk(e.target.value)} />
            )}
          </Field>
          <Field id="pc-mileage" label="Mileage" errors={fields.mileage}>
            {({ id, describedBy, invalid }) => (
              <input id={id} className="inp mono" inputMode="numeric" value={mileage} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setMileage(e.target.value)} />
            )}
          </Field>
          <Field id="pc-zip" label="Your ZIP" errors={fields.zip}>
            {({ id, describedBy, invalid }) => (
              <input id={id} className="inp mono" inputMode="numeric" maxLength={5} autoComplete="postal-code" value={zip} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setZip(e.target.value)} />
            )}
          </Field>
        </div>

        {trimCandidates.length > 0 && (
          <div className="sheet" style={{ marginTop: 16, padding: 24, maxWidth: 520 }}>
            <Field id="pc-trim" label="This VIN matches more than one trim. Which one is it?" errors={fields.trim}>
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={trim} onChange={setTrim} options={trimCandidates.map((t) => ({ value: t, label: t }))} />
              )}
            </Field>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <SegmentedControl<Seller>
            label="Seller type"
            value={seller}
            onChange={pickSeller}
            options={[{ value: 'dealer', label: 'Dealer' }, { value: 'private', label: 'Private seller' }]}
          />
          <button type="submit" className="btn" disabled={checking}>{checking ? 'Checking the price' : 'Check this price'}</button>
        </div>
        {fields.sellerType && <p className="err" style={{ marginTop: 8 }}>{fields.sellerType[0]}</p>}
      </form>

      {r && <p className="small" style={{ margin: '12px 0 0' }}>{decodedLine(r.vehicle)}</p>}

      {error && (
        <div style={{ marginTop: 24 }} role="alert">
          {tooFew ? (
            <div className="notice">
              <p style={{ margin: 0 }}>
                We found {num(error.details.compCount as number)} similar car{error.details.compCount === 1 ? '' : 's'} for sale near {zip || 'that ZIP'}; we need{' '}
                {num(error.details.minComps as number)} for a fair range. Try the ZIP of a larger city nearby.
              </p>
            </div>
          ) : upstream ? (
            <div className="notice">
              <p style={{ margin: 0 }}>The listing service didn&rsquo;t respond.</p>
              <button type="button" className="btn-o" style={{ marginTop: 14 }} onClick={() => void check()}>Try again</button>
            </div>
          ) : (
            <ErrorNote error={error} onRetry={error.status >= 500 || error.status === 0 ? () => void check() : undefined} />
          )}
        </div>
      )}

      <div className="g2" style={{ marginTop: 40, alignItems: 'start', gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)' }} aria-busy={checking}>
        <div className="sheet" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {checking && !r ? (
            <>
              <Skeleton w="60%" h={52} />
              <Skeleton h={20} />
              <Skeleton h={60} />
              <Skeleton h={40} />
            </>
          ) : r && bar ? (
            <>
              <h2 style={{ margin: 0, fontSize: 48, fontWeight: 600, letterSpacing: '-.02em' }}>{r.verdictLabel}</h2>
              <p className="lede" style={{ margin: 0 }}>{r.verdictNote}</p>
              <svg viewBox="0 0 100 26" width="100%" height="60" preserveAspectRatio="none" role="img" aria-label={`Fair range ${usd(r.fairRange.low)} to ${usd(r.fairRange.high)}; asking ${usd(r.askingPrice)}.`}>
                <path d="M0 14 L100 14" stroke="var(--ink)" strokeWidth=".3" vectorEffect="non-scaling-stroke" />
                <rect x={bar.rx} y="8" width={bar.rw} height="12" fill="var(--tone)" stroke="var(--ink)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <path d={`M${bar.mx} 2 L${bar.mx} 26`} stroke="var(--ink)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="dim" style={{ marginTop: -8 }}>
                <span>fair range {usd(r.fairRange.low)} to {usd(r.fairRange.high)}</span>
                <span style={{ marginLeft: 'auto' }}>asking {usd(r.askingPrice)}</span>
              </div>
              <p className="small" style={{ margin: 0 }}>
                Based on {num(r.compCount)} similar cars for sale near {lastBody?.zip}, {r.fairRange.basis === 'retail' ? 'priced as dealer retail' : 'priced as a private sale'}.
              </p>
              {r.warnings.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {r.warnings.map((w) => <li key={w} className="small" style={{ color: 'var(--ink)' }}>{w}</li>)}
                </ul>
              )}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span className="label">Suggested first offer</span>
                <span className="mono" style={{ fontSize: 32 }}>{usd(r.suggestedFirstOffer)}</span>
              </div>
              <button type="button" className="btn" onClick={save} disabled={saving || saveState?.ok}>
                {saving ? 'Saving this car' : saveState?.ok ? 'Saved' : 'Save this car'}
              </button>
              <div role="status">
                {saveState && (
                  <p style={{ margin: 0 }}>
                    {saveState.msg}{' '}
                    {!saveState.ok && saveState.msg.startsWith('Sign in') && <Link href="/sign-in">Sign in</Link>}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 17 }}>Your verdict appears here once you check a price.</p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {r && (
            <div className="sheet" style={{ padding: 22 }}>
              <h2 className="label">Before you buy</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {r.checklist.map((c) => (
                  <li key={c.key} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                    <input type="checkbox" id={`pb-${c.key}`} style={{ width: 20, height: 20, accentColor: 'var(--blue)', flex: '0 0 auto' }} />
                    <label htmlFor={`pb-${c.key}`}>
                      <span style={{ fontWeight: 500 }}>{c.title}</span>
                      <span className="small" style={{ display: 'block', marginTop: 3 }}>{c.detail}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r && (
            <div className="sheet" style={{ padding: 22 }}>
              <h2 className="label">Ask the seller</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
                {r.questions.map((q) => (
                  <li key={q} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 40, padding: '8px 8px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 12px 4px', flexWrap: 'wrap' }}>
          <h2 className="label">Compare saved cars, up to 3</h2>
          {saved.data && items.length > 0 && (
            <button type="button" className="ghost small" style={{ minHeight: 44, textDecoration: 'underline' }} onClick={() => vinRef.current?.focus()}>
              Add a car
            </button>
          )}
        </div>
        <div style={{ padding: '8px 12px 16px' }}>
          {saved.loading && !saved.data ? (
            <Skeleton h={160} />
          ) : saved.error?.status === 401 ? (
            <div className="notice">
              <p style={{ margin: 0 }}>Sign in to save cars and compare them side by side.</p>
              <Link className="btn" href="/sign-in" style={{ marginTop: 14 }}>Sign in</Link>
            </div>
          ) : saved.error ? (
            <ErrorNote error={saved.error} onRetry={saved.reload} />
          ) : items.length === 0 ? (
            <EmptyState
              text="No saved cars yet. Check a price above, then save it to compare."
              action={<button type="button" className="btn-o" onClick={() => vinRef.current?.focus()}>Check a price</button>}
            />
          ) : (
            <>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small" style={{ padding: 0 }}>Pick up to 3 to compare.</legend>
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                  {items.map((i) => {
                    const on = selIds.includes(i.id);
                    const full = !on && selIds.length >= COMPARE_MAX;
                    return (
                      <li key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
                        <input
                          type="checkbox"
                          id={`cmp-${i.id}`}
                          checked={on}
                          disabled={full}
                          onChange={(e) => toggle(i.id, e.target.checked)}
                          style={{ width: 20, height: 20, accentColor: 'var(--blue)' }}
                        />
                        <label htmlFor={`cmp-${i.id}`} style={{ flex: 1, minWidth: 200, minHeight: 44, display: 'flex', alignItems: 'center' }}>
                          {i.label}, {miles(i.mileage)}, asking {usd(i.askingPrice)}
                        </label>
                        <button type="button" className="btn-o" onClick={() => remove(i.id)} disabled={removing === i.id} aria-label={`Remove ${i.label} asking ${usd(i.askingPrice)}`}>
                          {removing === i.id ? 'Removing' : 'Remove'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              {removeErr && <div style={{ marginTop: 10 }}><ErrorNote error={removeErr} /></div>}
              {selIds.length === 0 ? (
                <p className="small" style={{ marginTop: 14 }}>Pick a saved car to see it in the table.</p>
              ) : compare.error ? (
                <div style={{ marginTop: 14 }}><ErrorNote error={compare.error} onRetry={compare.reload} /></div>
              ) : !compare.data ? (
                <Skeleton h={140} style={{ marginTop: 14 }} />
              ) : (
                <div className="scroll-x" tabIndex={0} role="region" aria-label="Saved cars comparison table" style={{ marginTop: 14 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">Car</th>
                        <th scope="col" className="num">Miles</th>
                        <th scope="col" className="num">Asking</th>
                        <th scope="col" className="num">Fair range</th>
                        <th scope="col">Seller</th>
                        <th scope="col">Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compare.data.rows.map((c) => (
                        <tr key={c.id}>
                          <td>{c.car}</td>
                          <td className="num">{num(c.miles)}</td>
                          <td className="num">{usd(c.asking)}</td>
                          <td className="num">{usd(c.fairLow)} to {usd(c.fairHigh)}</td>
                          <td>{c.seller === 'dealer' ? 'Dealer' : 'Private'}</td>
                          <td>{c.verdictLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
