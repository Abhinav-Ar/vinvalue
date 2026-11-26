'use client';
/** /garage, ported from design/Garage.dc.html. Data: GET /api/vehicles. */
import Link from 'next/link';
import { SaleOutcomePrompts, VehicleSaleActions } from './SaleOutcomeCard';
import { useState } from 'react';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
import { EmptyState, ErrorNote, Skeleton } from '@/views/components/ui';
import { api, useApi, type ApiError } from '@/views/components/client/api';
import { miles, shortDate, usd, usdSigned } from '@/views/components/client/format';
import g from './garageList.module.css';
import { GarageTabs, asApiError, flagText, type GarageResponse, type GarageVehicle } from './shared';

export function GarageView() {
  const { data, error, loading, reload } = useApi<GarageResponse>('/api/vehicles');
  const t = data?.totals;

  return (
    <section className="wrap page">
      <div className={g.top}>
        <h1 className="title">Garage</h1>
        {(loading || (t && t.vehicles > 0)) && (
          <div className="stats">
            <div>
              <p className="kicker">Cars</p>
              {t ? <p className="stat-v">{t.vehicles}</p> : <Skeleton w={40} h={30} style={{ marginTop: 4 }} />}
            </div>
            <div>
              <p className="kicker">Private value</p>
              {t ? <p className="stat-v accent">{usd(t.totalPrivateValue)}</p> : <Skeleton w={110} h={30} style={{ marginTop: 4 }} />}
            </div>
            <div>
              <p className="kicker">Due in 30 days</p>
              {t ? <p className="stat-v"><Link href="/garage/maintenance" aria-label={`${t.dueIn30Days} services due in 30 days, view maintenance`}>{t.dueIn30Days}</Link></p> : <Skeleton w={40} h={30} style={{ marginTop: 4 }} />}
            </div>
          </div>
        )}
      </div>
      <GarageTabs on="vehicles" />
      <SaleOutcomePrompts />

      {error && <ErrorNote error={error} onRetry={reload} />}

      {!error && data && data.vehicles.length === 0 && (
        <EmptyState text="No cars yet. Appraise one to add it." action={<Link className="btn" href="/appraise">Appraise a car</Link>} />
      )}

      {!error && (loading || (data && data.vehicles.length > 0)) && (
        <div className={g.lot}>
          {loading && !data
            ? [0, 1, 2].map((i) => <Skeleton key={i} h={380} />)
            : data!.vehicles.map((v) => <VehicleCard key={v.id} v={v} onRefreshed={reload} />)}
        </div>
      )}
      {data && data.vehicles.length > 0 && (
        <Link className="btn-o" href="/appraise" style={{ marginTop: 'var(--s7)' }}>Add a car <span className="arr" aria-hidden="true">→</span></Link>
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
  // "2019 Ford Mustang GT" -> year, make (first word), model (the rest).
  const identity = v.label.match(/^(\d{4})\s+(\S+)\s+(.+)$/);
  const photoCar = identity ? { year: identity[1], make: identity[2], model: identity[3] } : { model: v.label };
  return (
    <article className={g.car}>
      <Link href={`/garage/${v.id}`} className={g.art} aria-label={`Open ${v.label}`}>
        <VehiclePhoto car={photoCar} interactive={false} />
      </Link>
      <div className={g.name}>
        <h2 className="h3"><Link href={`/garage/${v.id}`}>{v.label}</Link></h2>
        <p className="small" style={{ margin: 0 }}>{miles(v.odometer)} · {v.zip}</p>
        {v.flags.map((f) => <p key={f} className="small" style={{ margin: 0 }}>{flagText(f)}</p>)}
      </div>
      <div className={g.value}>
        {v.privateValue != null ? <span className="stat-v">{usd(v.privateValue)}</span> : <span>No value yet</span>}
        {change && <span className="small">{change}</span>}
      </div>
      <Link href={`/garage/maintenance?vehicle=${v.id}`} className={g.service} data-late={ns?.overdue || undefined}>
        {ns ? <><span>{ns.title}</span><span>{shortDate(ns.date)} · {ns.statusText}</span></> : <span>No service scheduled</span>}
      </Link>
      <div className="card-actions">
        <button type="button" className="textbtn" onClick={refresh} disabled={busy} aria-busy={busy}>
          {busy ? 'Refreshing…' : 'Refresh value'}
        </button>
        <VehicleSaleActions vehicleId={v.id} onChanged={onRefreshed} />
      </div>
      {err && <p className="err" role="alert">{err.message}</p>}
    </article>
  );
}
