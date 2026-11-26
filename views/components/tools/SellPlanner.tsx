'use client';
/**
 * Sell or trade (design/Sell): instant offer vs trade-in vs private sale, state checklist, listing kit.
 */
import Link from 'next/link';
import { SaleOutcomePrompts } from '@/views/components/garage/SaleOutcomeCard';
import { useEffect, useRef, useState } from 'react';
import type { SellPlanView } from '@/models/sell/service';
import { api, ApiError, useApi } from '@/views/components/client/api';
import { usd } from '@/views/components/client/format';
import { EmptyState, ErrorNote, Field, Select, Skeleton } from '@/views/components/ui';
import layout from '../garage/garage.module.css';
import styles from './vehicle-tools.module.css';
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
      setCopyStatus('Listing copied.');
    } catch {
      setCopyStatus('Your browser blocked copying. Select the text above and copy it yourself.');
    }
  }

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (vehicle.error?.status === 401 || error?.status === 401) {
    return <section className={`wrap page ${layout.page}`}><ErrorNote error={vehicle.error ?? error} /></section>;
  }
  if (vehicle.error?.status === 404 || error?.status === 404) {
    return (
      <section className={`wrap page ${layout.page}`}>
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
    <section className={`wrap page ${layout.page}`}>
      <VehicleHeader vehicle={vehicle.data} vehicleId={vehicleId} section="sell" />
      {vehicle.error && <div style={{ marginTop: 'var(--s5)' }}><ErrorNote error={vehicle.error} onRetry={vehicle.reload} /></div>}

      {error?.status === 409 ? (
        <div style={{ marginTop: 'var(--s6)' }}>
          <EmptyState text={error.message} action={<Link className="btn" href="/appraise">Appraise this car</Link>} />
        </div>
      ) : error && !plan ? (
        <div style={{ marginTop: 'var(--s6)' }}><ErrorNote error={error} onRetry={() => void load(inputs)} /></div>
      ) : (
        <>
          <div className={`g3 ${layout.section} ${styles.controls}`}>
            <div className={layout.group}>
              <label htmlFor="po">
                Loan payoff left: {usd(inputs.loanPayoff)}
              </label>
              <input
                id="po"
                type="range"
                min={0}
                max={payoffMax}
                step={500}
                value={inputs.loanPayoff}
                onChange={(e) => setInputs((s) => ({ ...s, loanPayoff: Number(e.target.value) }))}
                className={styles.range}
              />
            </div>
            <div className={layout.group}>
              <label htmlFor="ak">
                Private asking price: {base ? usd(ask) : '–'}
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
                className={styles.range}
              />
            </div>
            <div>
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
          <div className={`g3 ${styles.routes}`} aria-busy={loading}>
            {plan
              ? routes.map((r) => {
                  const best = r.key === plan.best;
                  return (
                    <article key={r.key} className={`sheet ${layout.group}`}>
                      <h3 className="h3">{r.name}</h3>
                      <div>
                        <div className={layout.spread}>
                          <p className={best ? 'stat-v accent' : 'stat-v'}>{usdNeg(r.net)}</p>
                          {best && <p className="small">{allNegative ? 'Lowest cost' : 'Highest proceeds'}</p>}
                        </div>
                        <p className="small">
                          {r.net < 0 ? `Still owed, ${r.time.toLowerCase()}` : `Net proceeds, ${r.time.toLowerCase()}`}
                        </p>
                      </div>
                      <svg viewBox="0 0 100 8" width="100%" height="8" preserveAspectRatio="none" aria-hidden="true">
                        <rect width={(r.price / maxPrice) * 100} height="8" fill="var(--tone)" />
                        <rect width={(Math.max(0, r.net) / maxPrice) * 100} height="8" fill={best ? 'var(--blue)' : 'var(--mid)'} />
                      </svg>
                      <dl className="kv">
                        <dt>Sale price</dt>
                        <dd>{usd(r.price)}</dd>
                        <dt>Costs</dt>
                        <dd>{r.costs ? '−' + usd(r.costs) : '$0'}</dd>
                        <dt>Loan payoff</dt>
                        <dd>{r.payoff ? '−' + usd(r.payoff) : '$0'}</dd>
                      </dl>
                      {r.costItems.length > 0 && (
                        <p className="small">
                          Costs: {r.costItems.map((c) => `${c.label.toLowerCase()} ${usd(c.amount)}`).join(', ')}.
                        </p>
                      )}
                      <p className="small">{r.note}</p>
                    </article>
                  );
                })
              : [0, 1, 2].map((i) => <Skeleton key={i} h={330} />)}
          </div>

          {error && plan && <div style={{ marginTop: 'var(--s4)' }}><ErrorNote error={error} onRetry={() => void load(inputs)} /></div>}

          {plan && allNegative && bestRoute && (
            <p className={styles.routeNote}>
              Your {usd(plan.loanPayoff)} payoff exceeds every route. Even {bestRoute.name.toLowerCase()} leaves {usd(-bestRoute.net)} owed to clear the title.
            </p>
          )}
          {plan && <p className={styles.routeNote}>{gapSentence(plan)}</p>}

          <div className={`g2 ${layout.section} ${styles.controls}`}>
            <section className={`sheet ${layout.group}`}>
              <h2 className="h3">
                {plan?.stateRulesAvailable && stateName ? `${stateName} seller checklist` : 'Seller checklist'}
              </h2>
              {plan && !plan.stateRulesAvailable && (
                <p className="small">
                  General checklist{stateName ? ` for ${stateName}` : ''}. Confirm local rules with your DMV.
                </p>
              )}
              {plan ? (
                <ul className={`${layout.list} ${styles.checklist}`}>
                  {plan.checklist.map((c) => (
                    <li key={c.key}>
                      <input
                        type="checkbox"
                        id={`ck-${c.key}`}
                        checked={!!checked[c.key]}
                        onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))}
                      />
                      <label htmlFor={`ck-${c.key}`}>
                        {c.title}
                        {!c.required && <span className="small"> (not required in every state)</span>}
                        <span className="small">{c.detail}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton h={300} />
              )}
            </section>

            <section className={`sheet ${layout.group}`}>
              <h2 className="h3">Listing kit</h2>
              <h3 className="kicker">Shot list</h3>
              {plan ? (
                <ul className={`${layout.list} ${styles.shots}`}>
                  {plan.listingKit.shotList.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <Skeleton h={260} />
              )}
              <h3 className="kicker">
                <label htmlFor="listing-desc">Description draft</label>
              </h3>
              <textarea
                id="listing-desc"
                className={`inp ${styles.description}`}
                rows={5}
                value={draft}
                onChange={(e) => {
                  edited.current = true;
                  setDraft(e.target.value);
                }}
              />
              <button type="button" className="btn" onClick={copyDraft} disabled={!draft}>
                {plan?.listingKit.reportLink ? 'Copy listing + report link' : 'Copy listing'}
              </button>
              <p className="small" role="status">{copyStatus}</p>
            </section>
          </div>

          {plan && <p className={`small ${styles.disclaimer}`}>{plan.disclaimer}</p>}
          {plan && vehicle.data && (
            <div className={layout.section}><SaleOutcomePrompts vehicleId={vehicleId} planned /></div>
          )}
        </>
      )}
    </section>
  );
}
