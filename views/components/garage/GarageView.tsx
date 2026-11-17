'use client';
/** /garage, ported from design/Garage.dc.html. Data: GET /api/vehicles. */
import Link from 'next/link';
import { useState } from 'react';
import { CarDrawing } from '@/views/components/CarDrawing';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { EmptyState, ErrorNote, Skeleton } from '@/views/components/ui';
import { api, useApi, type ApiError } from '@/views/components/client/api';
import { miles, shortDate, usd, usdSigned } from '@/views/components/client/format';
import { GarageTabs, asApiError, carVariant, flagText, type GarageResponse, type GarageVehicle } from './shared';

const big = { margin: '6px 0 0', fontSize: 24 } as const;

export function GarageView() {
  const { data, error, loading, reload } = useApi<GarageResponse>('/api/vehicles');
  const t = data?.totals;

  return (
    <section className="wrap" style={{ paddingTop: 64, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
        <h1 className="title">Garage</h1>
        {(loading || (t && t.vehicles > 0)) && (
          <div className="sheet g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 0, flex: '0 1 520px' }}>
            <div className="cell">
              <p className="label">Vehicles</p>
              {t ? <p className="mono" style={big}>{t.vehicles}</p> : <Skeleton w={40} h={29} style={{ marginTop: 6 }} />}
            </div>
            <div className="cell">
              <p className="label">Private value</p>
              {t ? <p className="mono" style={{ ...big, color: 'var(--blue)' }}>{usd(t.totalPrivateValue)}</p> : <Skeleton w={110} h={29} style={{ marginTop: 6 }} />}
            </div>
            <div className="cell">
              <p className="label">Due in 30 days</p>
              {t ? (
                <p className="mono" style={big}>
                  {t.dueIn30Days} <Link href="/garage/maintenance" style={{ fontSize: 13 }} aria-label="View maintenance due in 30 days">view</Link>
                </p>
              ) : <Skeleton w={60} h={29} style={{ marginTop: 6 }} />}
            </div>
          </div>
        )}
      </div>
      <GarageTabs on="vehicles" />

      {error && <div style={{ marginTop: 40 }}><ErrorNote error={error} onRetry={reload} /></div>}

      {!error && data && data.vehicles.length === 0 && (
        <div style={{ marginTop: 40 }}>
          <EmptyState text="Your garage is empty. Appraise a car to add it here." action={<Link className="btn" href="/appraise">Appraise a car</Link>} />
        </div>
      )}

      {!error && (loading || (data && data.vehicles.length > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 24, marginTop: 40 }}>
          {loading && !data
            ? [0, 1, 2].map((i) => <Skeleton key={i} h={420} />)
            : data!.vehicles.map((v) => <VehicleCard key={v.id} v={v} onRefreshed={reload} />)}
          {data && (
            <Link href="/appraise" style={{ border: '1.5px dashed var(--line)', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textDecoration: 'none', color: 'var(--ink)' }}>
              <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><path d="M22 6 L22 38 M6 22 L38 22" stroke="currentColor" strokeWidth="1.5" /></svg>
              <span style={{ fontSize: 18, fontWeight: 500 }}>Add a vehicle</span>
              <span className="small">Starts a new appraisal</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function changeText(v: GarageVehicle): string | null {
  if (v.change) {
    return v.change.amount === 0 ? `No change since ${shortDate(v.change.sinceDate)}` : `${usdSigned(v.change.amount)} since ${shortDate(v.change.sinceDate)}`;
  }
  return v.lastAppraisedAt ? `Appraised ${shortDate(v.lastAppraisedAt)}` : null;
}

function VehicleCard({ v, onRefreshed }: { v: GarageVehicle; onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const ns = v.nextService;

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/vehicles/${v.id}/refresh-value`, { method: 'POST' });
      onRefreshed();
    } catch (e) {
      setErr(asApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const change = changeText(v);
  const identity = v.label.match(/^(\d{4})\s+(.+?)\s+([^ ]+)$/);
  const photoCar = identity ? { year: identity[1], make: identity[2], model: identity[3] } : { model: v.label };
  return (
    <article className="sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}><VehiclePhoto car={photoCar} /></div>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{v.label}</h2>
        <p className="mono small" style={{ margin: '6px 0 0' }}>{miles(v.odometer)}, {v.zip}</p>
        {v.flags.map((f) => <p key={f} className="small" style={{ margin: '6px 0 0' }}>{flagText(f)}</p>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {v.privateValue != null
          ? <span className="mono" style={{ fontSize: 30 }}>{usd(v.privateValue)}</span>
          : <span style={{ fontSize: 17 }}>No value yet</span>}
        {change && <span className="mono small">{change}</span>}
      </div>
      {ns ? (
        <Link
          href={`/garage/maintenance?vehicle=${v.id}`}
          style={{ textDecoration: 'none', color: 'var(--ink)', border: `1px ${ns.overdue ? 'dashed' : 'solid'} var(--ink)`, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
        >
          <span><span className="label" style={{ display: 'block', marginBottom: 4 }}>Next service</span>{ns.title}</span>
          <span className="mono" style={{ fontSize: 13, alignSelf: 'end', ...(ns.overdue ? { fontWeight: 600 } : { color: 'var(--mid)' }) }}>
            {shortDate(ns.date)}, {ns.statusText}
          </span>
        </Link>
      ) : (
        <Link href={`/garage/maintenance?vehicle=${v.id}`} style={{ textDecoration: 'none', color: 'var(--ink)', border: '1px solid var(--line)', padding: '12px 14px', display: 'block' }}>
          <span className="label" style={{ display: 'block', marginBottom: 4 }}>Next service</span>Nothing scheduled
        </Link>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <Link className="btn-o" href={`/garage/${v.id}`} style={{ flex: 1 }}>Open car</Link>
        <button type="button" className="btn-o" style={{ flex: 1 }} onClick={refresh} disabled={busy} aria-busy={busy}>
          {busy ? 'Refreshing' : 'Refresh value'}
        </button>
      </div>
      {err && <p className="err" role="alert">{err.message}</p>}
    </article>
  );
}
