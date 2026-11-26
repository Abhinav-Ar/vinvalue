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
import layout from '../garage/garage.module.css';
import styles from './vehicle-tools.module.css';
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
        `Alert set for drops below ${usd(targetN)}.` +
          (already ? ` Today’s value is ${usd(v.today.value)}. It must rise above your target before a drop triggers the alert.` : ''),
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
    return <section className={`wrap page ${layout.page}`}><ErrorNote error={vehicle.error ?? valueError} /></section>;
  }
  if (notFound) {
    return (
      <section className={`wrap page ${layout.page}`}>
        <EmptyState text="We could not find this car in your garage." action={<Link className="btn" href="/garage">Go to your garage</Link>} />
      </section>
    );
  }

  const drop = v?.expectedDrop ?? 0;
  const inSource = mpy == null && v ? v.milesPerYearSource : 'query';

  return (
    <section className={`wrap page ${layout.page}`}>
      <VehicleHeader vehicle={vehicle.data} vehicleId={vehicleId} section="value" />
      {vehicle.error && <div style={{ marginTop: 'var(--s5)' }}><ErrorNote error={vehicle.error} onRetry={vehicle.reload} /></div>}

      {noAppraisal ? (
        <div style={{ marginTop: 'var(--s6)' }}>
          <EmptyState text={valueError!.message} action={<Link className="btn" href="/appraise">Appraise this car</Link>} />
        </div>
      ) : valueError && !v ? (
        <div style={{ marginTop: 'var(--s6)' }}><ErrorNote error={valueError} onRetry={value.reload} /></div>
      ) : (
        <>
          <div className={`stats ${layout.section}`}>
            <div>
              <p className="kicker">Today</p>
              {v ? <p className="stat-v accent">{usd(v.today.value)}</p> : <Skeleton w={120} h={32} />}
              <p className="small">Private sale</p>
            </div>
            <div>
              <p className="kicker">In 12 months</p>
              {v ? <p className="stat-v">{usd(v.in12)}</p> : <Skeleton w={120} h={32} />}
              <p className="small">Forecast midpoint</p>
            </div>
            <div>
              <p className="kicker">Expected drop</p>
              {v ? (
                <p className="stat-v">{drop > 0 ? '−' + usd(drop) : 'None'}</p>
              ) : <Skeleton w={120} h={32} />}
              <p className="small">{v && drop < 0 ? `Forecast gain of ${usd(-drop)}` : 'Over the next year'}</p>
            </div>
            <div>
              <p className="kicker">Best time to sell</p>
              {v ? (
                <>
                  <p className="stat-v">{monthLabel(v.bestMonthToSell.month)}</p>
                  <p className="small">About {usd(v.bestMonthToSell.value)}</p>
                </>
              ) : <Skeleton w={144} h={32} />}
            </div>
          </div>

          <section className={`sheet ${layout.group} ${layout.section}`}>
            <h2 className="h3">Value history and forecast</h2>
            <p className="small">Solid for appraisals, dashed for the forecast, shaded for the likely range.</p>
            {v ? (
              <div aria-busy={value.loading}>
                <ValueChart history={v.history} forecast={v.forecast} today={v.today} best={v.bestMonthToSell} alert={targetN} />
              </div>
            ) : (
              <Skeleton h={300} />
            )}
          </section>

          <div className={`g2 ${layout.section} ${styles.controls}`}>
            <section className={`sheet ${layout.group}`}>
              <h2 className="h3">Mileage scenario</h2>
              <label htmlFor="mpy">
                Miles per year: {num(sliderVal)}
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
                className={styles.range}
              />
              {inSource === 'observed' && <p className="small">Starting mileage comes from your odometer readings.</p>}
              {inSource === 'default' && <p className="small">Add odometer readings to start from your own pace.</p>}
            </section>

            <section className={`sheet ${layout.group}`}>
              <h2 className="h3">Price alert</h2>
              <Field label="Tell me if the value drops below" errors={saveErr}>
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="inp"
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
                <div className={layout.group}>
                  <h3 className="h3">Your alerts</h3>
                  <ul className={`${layout.list} ${styles.alerts}`}>
                    {mine.map((w) => (
                      <li key={w.id} className={layout.spread}>
                        <span>
                          {w.direction === 'below' ? 'Below' : 'Above'} {usd(w.threshold)}
                          {w.lastTriggeredAt && <span className="small" style={{ display: 'block' }}>Last sent {longDate(w.lastTriggeredAt)}</span>}
                        </span>
                        <button type="button" className="textbtn" onClick={() => removeWatch(w.id)} disabled={removing === w.id} aria-label={`Remove the alert ${w.direction} ${usd(w.threshold)}`}>
                          {removing === w.id ? 'Removing' : 'Remove'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {listErr && <ErrorNote error={listErr} />}
                </div>
              ) : null}
            </section>
          </div>

          {v && <p className={`small ${styles.disclaimer}`}>{v.disclaimer}</p>}
        </>
      )}
    </section>
  );
}
