'use client';
/**
 * Value tracker (design/Value): appraisal history, 12-month forecast, mileage scenario, price alert.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ValueTrackerView } from '@/models/forecast/service';
import { api, ApiError, useApi } from '@/views/components/client/api';
import { longDate, usd, num } from '@/views/components/client/format';
import { EmptyState, ErrorNote, Field, Skeleton } from '@/views/components/ui';
import { ValueChart, monthLabel } from '@/views/components/charts';
import { VehicleHeader, type VehicleDetail } from './VehicleHeader';
import { parseDollars, useDebounced } from './hooks';

type PriceWatch = {
  id: string;
  vehicleId: string | null;
  buyCheckId: string | null;
  threshold: number;
  direction: 'below' | 'above';
  lastValue: number | null;
  lastTriggeredAt: string | null;
  createdAt: string;
};

const MPY_MIN = 4000;
const MPY_MAX = 24000;
const MPY_STEP = 500;

export function ValueTracker({ vehicleId }: { vehicleId: string }) {
  const vehicle = useApi<VehicleDetail>(`/api/vehicles/${vehicleId}`);

  const [mpy, setMpy] = useState<number | null>(null);
  const mpyQ = useDebounced(mpy, 300);
  const value = useApi<ValueTrackerView>(`/api/vehicles/${vehicleId}/value${mpyQ != null ? `?milesPerYear=${mpyQ}` : ''}`);
  const v = value.data;

  const watches = useApi<{ items: PriceWatch[] }>('/api/price-watches');
  const mine = useMemo(() => (watches.data?.items ?? []).filter((w) => w.vehicleId === vehicleId), [watches.data, vehicleId]);

  const [target, setTarget] = useState('');
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !watches.data) return;
    const first = mine[0];
    setTarget(first ? num(first.threshold) : v ? num(Math.round((v.today.value * 0.95) / 500) * 500) : '');
    if (first || v) setSeeded(true);
  }, [seeded, watches.data, mine, v]);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string[] | undefined>();
  const [status, setStatus] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [listErr, setListErr] = useState<ApiError | null>(null);

  const targetN = parseDollars(target);

  async function saveTarget() {
    setStatus('');
    setSaveErr(undefined);
    if (!targetN) {
      setSaveErr(['Enter a dollar amount, like 24,000.']);
      return;
    }
    setSaving(true);
    try {
      await api('/api/price-watches', { body: { vehicleId, threshold: targetN, direction: 'below' } });
      await watches.reload();
      const already = v && v.today.value < targetN;
      setStatus(
        `Alert set. We will tell you if it drops below ${usd(targetN)}.` +
          (already ? ` It is already below that today at ${usd(v.today.value)}, so the alert fires after the value rises above ${usd(targetN)} and drops again.` : ''),
      );
    } catch (e) {
      const err = e as ApiError;
      setSaveErr(err.fields?.threshold ?? [err.message]);
    } finally {
      setSaving(false);
    }
  }

  async function removeWatch(id: string) {
    setRemoving(id);
    setListErr(null);
    try {
      await api(`/api/price-watches/${id}`, { method: 'DELETE' });
      await watches.reload();
      setStatus('Alert removed.');
    } catch (e) {
      setListErr(e as ApiError);
    } finally {
      setRemoving(null);
    }
  }

  // Slider range widens to fit the observed figure (e.g. 10,500 or 30,000 from odometer readings).
  const sliderVal = mpy ?? v?.milesPerYear ?? 10000;
  const lo = Math.min(MPY_MIN, Math.floor(sliderVal / MPY_STEP) * MPY_STEP);
  const hi = Math.max(MPY_MAX, Math.ceil(sliderVal / MPY_STEP) * MPY_STEP);

  const valueError = value.error;
  const noAppraisal = valueError?.status === 409;
  const notFound = vehicle.error?.status === 404 || valueError?.status === 404;

  if (vehicle.error?.status === 401 || valueError?.status === 401) {
    return <section className="wrap page"><ErrorNote error={vehicle.error ?? valueError} /></section>;
  }
  if (notFound) {
    return (
      <section className="wrap page">
        <EmptyState text="We could not find this car in your garage." action={<Link className="btn" href="/garage">Go to your garage</Link>} />
      </section>
    );
  }

  const drop = v?.expectedDrop ?? 0;
  const inSource = mpy == null && v ? v.milesPerYearSource : 'query';

  return (
    <section className="wrap page">
      <VehicleHeader vehicle={vehicle.data} vehicleId={vehicleId} section="value" />
      {vehicle.error && <div style={{ marginTop: 24 }}><ErrorNote error={vehicle.error} onRetry={vehicle.reload} /></div>}

      {noAppraisal ? (
        <div style={{ marginTop: 32 }}>
          <EmptyState text={valueError!.message} action={<Link className="btn" href="/appraise">Appraise this car</Link>} />
        </div>
      ) : valueError && !v ? (
        <div style={{ marginTop: 32 }}><ErrorNote error={valueError} onRetry={value.reload} /></div>
      ) : (
        <>
          <div className="sheet g4" style={{ marginTop: 32, gap: 0 }}>
            <div className="cell">
              <p className="label">Today</p>
              {v ? <p className="mono" style={{ margin: '6px 0 0', fontSize: 26, color: 'var(--blue)' }}>{usd(v.today.value)}</p> : <Skeleton w={120} h={32} style={{ marginTop: 6 }} />}
              <p className="small" style={{ margin: '4px 0 0' }}>private sale</p>
            </div>
            <div className="cell">
              <p className="label">In 12 months</p>
              {v ? <p className="mono" style={{ margin: '6px 0 0', fontSize: 26 }}>{usd(v.in12)}</p> : <Skeleton w={120} h={32} style={{ marginTop: 6 }} />}
              <p className="small" style={{ margin: '4px 0 0' }}>forecast midpoint</p>
            </div>
            <div className="cell">
              <p className="label">Expected drop</p>
              {v ? (
                <p className="mono" style={{ margin: '6px 0 0', fontSize: 26 }}>{drop > 0 ? '−' + usd(drop) : 'None'}</p>
              ) : (
                <Skeleton w={120} h={32} style={{ marginTop: 6 }} />
              )}
              <p className="small" style={{ margin: '4px 0 0' }}>{v && drop <= 0 ? `forecast holds or gains ${usd(-drop)}` : 'over the next year'}</p>
            </div>
            <div className="cell">
              <p className="label">Best time to sell</p>
              {v ? (
                <p style={{ margin: '6px 0 0', fontSize: 18, color: 'var(--blue)' }}>
                  {monthLabel(v.bestMonthToSell.month)}, about {usd(v.bestMonthToSell.value)}
                </p>
              ) : (
                <Skeleton w={160} h={24} style={{ marginTop: 6 }} />
              )}
            </div>
          </div>

          <div className="sheet" style={{ marginTop: 24, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              <h2 className="label" style={{ fontSize: 13 }}>Value history and forecast</h2>
              <p className="small" style={{ margin: 0 }}>Solid line: your appraisals. Dashed: forecast. Shaded: likely range.</p>
            </div>
            {v ? (
              <div aria-busy={value.loading}>
                <ValueChart history={v.history} forecast={v.forecast} today={v.today} best={v.bestMonthToSell} alert={targetN} />
              </div>
            ) : (
              <Skeleton h={300} />
            )}
          </div>

          <div className="g2" style={{ marginTop: 24, alignItems: 'start' }}>
            <div className="sheet" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 className="label" style={{ fontSize: 13 }}>Mileage scenario</h2>
              <label htmlFor="mpy" style={{ fontSize: 18 }}>
                Miles per year: <span className="mono" style={{ color: 'var(--blue)' }}>{num(sliderVal)} mi / year</span>
              </label>
              <input
                id="mpy"
                type="range"
                min={lo}
                max={hi}
                step={MPY_STEP}
                value={sliderVal}
                disabled={!v}
                onChange={(e) => setMpy(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--blue)', minHeight: 44 }}
              />
              <p className="small" style={{ margin: 0 }}>
                Moves the forecast and the best time to sell.
                {inSource === 'observed' && ' Starts at your pace from your odometer readings.'}
                {inSource === 'default' && ' Starts at a typical pace; add odometer readings to use yours.'}
              </p>
            </div>

            <div className="sheet" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h2 className="label" style={{ fontSize: 13 }}>Price alert</h2>
              <Field label="Tell me if the value drops below" errors={saveErr}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="inp mono"
                    inputMode="numeric"
                    value={target}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    onChange={(e) => {
                      setTarget(e.target.value);
                      setSeeded(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTarget();
                    }}
                  />
                )}
              </Field>
              <button type="button" className="btn" onClick={saveTarget} disabled={saving || watches.error?.status === 401}>
                {saving ? 'Saving alert' : 'Save alert'}
              </button>
              <p className="small" style={{ margin: 0, color: 'var(--ink)' }} role="status">{status}</p>
              {watches.loading && !watches.data ? (
                <Skeleton h={44} />
              ) : watches.error ? (
                <ErrorNote error={watches.error} onRetry={watches.reload} />
              ) : mine.length ? (
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: '4px 0 0' }}>Your alerts for this car</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                    {mine.map((w) => (
                      <li key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                        <span>
                          {w.direction === 'below' ? 'Below' : 'Above'} <span className="mono">{usd(w.threshold)}</span>
                          {w.lastTriggeredAt && <span className="small" style={{ display: 'block' }}>Last sent {longDate(w.lastTriggeredAt)}</span>}
                        </span>
                        <button type="button" className="btn-o" onClick={() => removeWatch(w.id)} disabled={removing === w.id} aria-label={`Remove the alert ${w.direction} ${usd(w.threshold)}`}>
                          {removing === w.id ? 'Removing' : 'Remove'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {listErr && <div style={{ marginTop: 10 }}><ErrorNote error={listErr} /></div>}
                </div>
              ) : null}
            </div>
          </div>

          {v && <p className="small mono" style={{ marginTop: 20 }}>{v.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
