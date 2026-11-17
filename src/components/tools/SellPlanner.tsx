'use client';
/**
 * Sell or trade (design/Sell): instant offer vs trade-in vs private sale, state checklist, listing kit.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SellPlanView } from '@/lib/sell/service';
import { api, ApiError, useApi } from '@/lib/client/api';
import { usd } from '@/lib/client/format';
import { EmptyState, ErrorNote, Field, Select, Skeleton } from '@/components/ui';
import { VehicleHeader, type VehicleDetail } from './VehicleHeader';
import { useDebounced, usdNeg } from './hooks';
import { STATE_OPTIONS, US_STATES } from './states';

type Inputs = { loanPayoff: number; askingPrice: number | null; state: string | null };

const round = (n: number, step: number) => Math.round(n / step) * step;

function gapSentence(plan: SellPlanView) {
  // The California note already states the gap; the generic one does not.
  if (/\bnets\b/.test(plan.taxNote)) return plan.taxNote;
  const g = plan.gap;
  const lead =
    g > 0 ? `Selling privately nets ${usd(g)} more than trading in.` : g < 0 ? `Trading in nets ${usd(-g)} more than selling privately.` : 'Selling privately and trading in net the same.';
  return `${lead} ${plan.taxNote}`;
}

export function SellPlanner({ vehicleId }: { vehicleId: string }) {
  const vehicle = useApi<VehicleDetail>(`/api/vehicles/${vehicleId}`);

  const [inputs, setInputs] = useState<Inputs>({ loanPayoff: 0, askingPrice: null, state: null });
  const q = useDebounced(inputs, 250);
  const [plan, setPlan] = useState<SellPlanView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<number | null>(null);
  const tick = useRef(0);

  async function load(body: Inputs) {
    const my = ++tick.current;
    setLoading(true);
    setError(null);
    try {
      const p = await api<SellPlanView>(`/api/vehicles/${vehicleId}/sell-plan`, {
        body: {
          loanPayoff: body.loanPayoff,
          ...(body.askingPrice != null ? { askingPrice: body.askingPrice } : {}),
          ...(body.state ? { state: body.state } : {}),
        },
      });
      if (my !== tick.current) return;
      setPlan(p);
      setBase((b) => b ?? p.askingPrice);
    } catch (e) {
      if (my === tick.current) setError(e instanceof ApiError ? e : new ApiError(0, 'internal', String(e)));
    } finally {
      if (my === tick.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, vehicleId]);

  // Listing description: filled from the plan once, then the user's edits win.
  const [draft, setDraft] = useState('');
  const edited = useRef(false);
  useEffect(() => {
    if (plan && !edited.current) setDraft(plan.listingKit.descriptionDraft);
  }, [plan]);
  const [copyStatus, setCopyStatus] = useState('');
  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopyStatus('Copied. Paste it into your listing.');
    } catch {
      setCopyStatus('Your browser blocked copying. Select the text above and copy it yourself.');
    }
  }

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (vehicle.error?.status === 401 || error?.status === 401) {
    return <section className="wrap page"><ErrorNote error={vehicle.error ?? error} /></section>;
  }
  if (vehicle.error?.status === 404 || error?.status === 404) {
    return (
      <section className="wrap page">
        <EmptyState text="We could not find this car in your garage." action={<Link className="btn" href="/garage">Go to your garage</Link>} />
      </section>
    );
  }

  const ask = inputs.askingPrice ?? plan?.askingPrice ?? base ?? 0;
  const askMin = base ? round(base * 0.8, 50) : 0;
  const askMax = base ? round(base * 1.2, 50) : 0;
  const payoffMax = Math.max(25000, base ? Math.ceil((base * 1.5) / 500) * 500 : 0);

  const routes = plan?.routes ?? [];
  const maxPrice = Math.max(1, ...routes.map((r) => r.price));
  const allNegative = routes.length > 0 && routes.every((r) => r.net < 0);
  const bestRoute = routes.find((r) => r.key === plan?.best);
  const stateName = plan?.state ? US_STATES[plan.state] ?? plan.state : null;

  return (
    <section className="wrap page">
      <VehicleHeader vehicle={vehicle.data} vehicleId={vehicleId} section="sell" />
      {vehicle.error && <div style={{ marginTop: 24 }}><ErrorNote error={vehicle.error} onRetry={vehicle.reload} /></div>}

      {error?.status === 409 ? (
        <div style={{ marginTop: 32 }}>
          <EmptyState text={error.message} action={<Link className="btn" href="/appraise">Appraise this car</Link>} />
        </div>
      ) : error && !plan ? (
        <div style={{ marginTop: 32 }}><ErrorNote error={error} onRetry={() => void load(inputs)} /></div>
      ) : (
        <>
          <div className="g3" style={{ marginTop: 32, gap: 24 }}>
            <div className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label htmlFor="po" style={{ fontSize: 16 }}>
                Loan payoff left: <span className="mono" style={{ color: 'var(--blue)' }}>{usd(inputs.loanPayoff)}</span>
              </label>
              <input
                id="po"
                type="range"
                min={0}
                max={payoffMax}
                step={500}
                value={inputs.loanPayoff}
                onChange={(e) => setInputs((s) => ({ ...s, loanPayoff: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--blue)', minHeight: 44 }}
              />
            </div>
            <div className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label htmlFor="ak" style={{ fontSize: 16 }}>
                Private asking price: <span className="mono" style={{ color: 'var(--blue)' }}>{base ? usd(ask) : '–'}</span>
              </label>
              <input
                id="ak"
                type="range"
                min={askMin}
                max={askMax}
                step={50}
                value={ask}
                disabled={!base}
                onChange={(e) => setInputs((s) => ({ ...s, askingPrice: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--blue)', minHeight: 44 }}
              />
            </div>
            <div className="sheet" style={{ padding: 22 }}>
              <Field label="State where you sell" hint={!inputs.state && plan?.state ? 'From your car’s ZIP code.' : undefined}>
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    value={inputs.state ?? plan?.state ?? ''}
                    onChange={(v) => setInputs((s) => ({ ...s, state: v || null }))}
                    options={[...(plan?.state ? [] : [{ value: '', label: 'Pick a state' }]), ...STATE_OPTIONS]}
                  />
                )}
              </Field>
            </div>
          </div>

          <h2 className="sr">Ways to sell</h2>
          <div className="g3" style={{ marginTop: 24 }} aria-busy={loading}>
            {plan
              ? routes.map((r) => {
                  const best = r.key === plan.best;
                  return (
                    <article
                      key={r.key}
                      className={`sheet route${best ? ' best' : ''}`}
                      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, ...(best ? { borderColor: 'var(--ink)', borderWidth: 2 } : {}) }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 20 }}>{r.name}</h3>
                        {best && <span className="small" style={{ color: 'var(--blue)', fontWeight: 600 }}>{allNegative ? 'Costs you least' : 'Most money'}</span>}
                      </div>
                      <p className="mono" style={{ margin: 0, fontSize: 34 }}>{usdNeg(r.net)}</p>
                      <p className="small" style={{ margin: '-6px 0 0' }}>
                        {r.net < 0 ? `you still owe your lender, ${r.time.toLowerCase()}` : `in your pocket, ${r.time.toLowerCase()}`}
                      </p>
                      <svg viewBox="0 0 100 14" width="100%" height="14" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="0" y="2" width={((r.price / maxPrice) * 100).toFixed(1)} height="10" fill="none" stroke="var(--ink)" strokeWidth=".4" />
                        <rect x="0" y="2" width={((Math.max(0, r.net) / maxPrice) * 100).toFixed(1)} height="10" fill="var(--blue)" />
                      </svg>
                      <dl className="mono" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, margin: 0 }}>
                        <dt>Sale price</dt>
                        <dd style={{ margin: 0 }}>{usd(r.price)}</dd>
                        <dt>Costs</dt>
                        <dd style={{ margin: 0 }}>{r.costs ? '−' + usd(r.costs) : '$0'}</dd>
                        <dt>Loan payoff</dt>
                        <dd style={{ margin: 0 }}>{r.payoff ? '−' + usd(r.payoff) : '$0'}</dd>
                      </dl>
                      {r.costItems.length > 0 && (
                        <p className="small" style={{ margin: 0 }}>
                          Costs: {r.costItems.map((c) => `${c.label.toLowerCase()} ${usd(c.amount)}`).join(', ')}.
                        </p>
                      )}
                      <p className="small" style={{ margin: 0, borderTop: '1px solid var(--line)', paddingTop: 10 }}>{r.note}</p>
                    </article>
                  );
                })
              : [0, 1, 2].map((i) => <Skeleton key={i} h={330} />)}
          </div>

          {error && plan && <div style={{ marginTop: 16 }}><ErrorNote error={error} onRetry={() => void load(inputs)} /></div>}

          {plan && allNegative && bestRoute && (
            <div className="notice" style={{ marginTop: 18 }}>
              <p style={{ margin: 0 }}>
                Your loan payoff of {usd(plan.loanPayoff)} is more than any route brings in. Even the {bestRoute.name.toLowerCase()} leaves you owing{' '}
                {usd(-bestRoute.net)}, which you pay the lender to clear the title.
              </p>
            </div>
          )}
          {plan && <p style={{ marginTop: 18, fontSize: 16, maxWidth: 820 }}>{gapSentence(plan)}</p>}

          <div className="g2" style={{ marginTop: 48, alignItems: 'start' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
                {plan?.stateRulesAvailable && stateName ? `${stateName} seller checklist` : 'Seller checklist'}
              </h2>
              {plan && !plan.stateRulesAvailable && (
                <p className="small" style={{ margin: '10px 0 0', color: 'var(--ink)' }}>
                  We only have detailed rules for California so far, so this is a general checklist{stateName ? ` for ${stateName}` : ''}. Check your state DMV for the exact steps.
                </p>
              )}
              {plan ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0' }}>
                  {plan.checklist.map((c) => (
                    <li key={c.key} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                      <input
                        type="checkbox"
                        id={`ck-${c.key}`}
                        checked={!!checked[c.key]}
                        onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))}
                        style={{ width: 20, height: 20, accentColor: 'var(--blue)', marginTop: 2, flex: '0 0 auto' }}
                      />
                      <label htmlFor={`ck-${c.key}`}>
                        <span style={{ fontWeight: 500 }}>{c.title}</span>
                        {!c.required && <span className="small"> (not required in every state)</span>}
                        <span className="small" style={{ display: 'block', marginTop: 4 }}>{c.detail}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton h={300} style={{ marginTop: 18 }} />
              )}
            </div>

            <div className="sheet" style={{ padding: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Listing kit</h2>
              <h3 style={{ margin: '18px 0 0', fontSize: 17 }}>Shot list</h3>
              {plan ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 18px' }}>
                  {plan.listingKit.shotList.map((s) => (
                    <li key={s} style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>{s}</li>
                  ))}
                </ul>
              ) : (
                <Skeleton h={260} style={{ margin: '10px 0 18px' }} />
              )}
              <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>
                <label htmlFor="listing-desc">Description draft</label>
              </h3>
              <textarea
                id="listing-desc"
                className="inp"
                rows={5}
                value={draft}
                onChange={(e) => {
                  edited.current = true;
                  setDraft(e.target.value);
                }}
                style={{ padding: '12px 16px', lineHeight: 1.5, resize: 'vertical' }}
              />
              <button type="button" className="btn-o" style={{ marginTop: 14, width: '100%' }} onClick={copyDraft} disabled={!draft}>
                {plan?.listingKit.reportLink ? 'Copy listing + report link' : 'Copy listing'}
              </button>
              <p className="small" role="status" style={{ margin: '10px 0 0', color: 'var(--ink)' }}>{copyStatus}</p>
            </div>
          </div>

          {plan && <p className="small mono" style={{ marginTop: 20 }}>{plan.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
