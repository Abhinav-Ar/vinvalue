'use client';
import { useEffect, useState } from 'react';
import { api, useApi } from '@/views/components/client/api';
import { Field } from '@/views/components/ui';
import styles from './garage.module.css';
import { asApiError } from './shared';

type Prompt = { id: string; vehicleKey: string; reason: string; dismissed: boolean; completed: boolean; snapshot: { year: number; make: string; model: string } };
export function SaleOutcomePrompts({ vehicleId, planned = false }: { vehicleId?: string; planned?: boolean }) {
  const prompts = useApi<{ items: Prompt[] }>('/api/sale-feedback');
  useEffect(() => {
    const reload = () => prompts.reload();
    window.addEventListener('sale-feedback-changed', reload);
    return () => window.removeEventListener('sale-feedback-changed', reload);
  }, [prompts.reload]);
  useEffect(() => {
    if (planned && vehicleId) void api(`/api/vehicles/${vehicleId}/sale-feedback`, { body: { reason: 'planned' } }).then(() => prompts.reload()).catch(() => {});
  // A plan becoming available creates the prompt once; later reloads only read it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planned, vehicleId]);
  return <>{prompts.data?.items.filter(p => vehicleId ? p.vehicleKey === vehicleId : p.reason !== 'planned').map(p => <SaleOutcomeCard key={p.id} prompt={p} onDone={prompts.reload} />)}</>;
}
function SaleOutcomeCard({ prompt, onDone }: { prompt: Prompt; onDone: () => void }) {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [route, setRoute] = useState('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(dismiss = false) {
    setBusy(true); setError('');
    try {
      if (dismiss) await api(`/api/sale-feedback/${prompt.id}`, { method: 'PATCH' });
      else await api(`/api/appraisals/${prompt.id}/outcome`, { body: { soldPrice: price, soldOn: date, route } });
      window.dispatchEvent(new Event('sale-feedback-changed'));
      onDone();
    } catch (e) { setError(asApiError(e).message); }
    finally { setBusy(false); }
  }
  return <form className={`sheet ${styles.group} ${styles.outcome}`} onSubmit={e => { e.preventDefault(); void submit(); }}>
    <h2 className="h3">Report sale price</h2>
    <p className="small">{prompt.snapshot.year} {prompt.snapshot.make} {prompt.snapshot.model}</p>
    <div className={styles.fields}>
      <Field label="Final sale price ($)">
        {({ id }) => <input id={id} className="inp" type="number" min="500" max="5000000" step="1" required value={price} onChange={e => setPrice(e.target.value)} />}
      </Field>
      <Field label="Sale date">
        {({ id }) => <input id={id} className="inp" type="date" required max={new Date().toISOString().slice(0, 10)} value={date} onChange={e => setDate(e.target.value)} />}
      </Field>
    </div>
    <Field label="How it sold">
      {({ id }) => (
        <select id={id} className="inp" value={route} onChange={e => setRoute(e.target.value)}>
          <option value="private">Private party</option>
          <option value="trade">Dealer trade-in</option>
          <option value="instant">Instant offer</option>
          <option value="auction">Auction</option>
        </select>
      )}
    </Field>
    <div className="row">
      <button className="btn-o" disabled={busy}>Save sale price</button>
      <button type="button" className="textbtn" disabled={busy} onClick={() => void submit(true)}>Dismiss</button>
    </div>
    {error && <p className="err" role="alert">{error}</p>}
  </form>;
}
export function VehicleSaleActions({ vehicleId, onChanged }: { vehicleId: string; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function act(remove: boolean) {
    setBusy(true); setError('');
    try {
      if (remove) await api(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
      else await api(`/api/vehicles/${vehicleId}/sale-feedback`, { body: { reason: 'sold' } });
      setChanged(true);
      setConfirming(false);
      window.dispatchEvent(new Event('sale-feedback-changed'));
      onChanged?.();
    } catch (e) { setError(asApiError(e).message); }
    finally { setBusy(false); }
  }
  return <div className={styles.group}>
    {confirming ? (
      <div className={styles.group} role="group" aria-label="Confirm removal">
        <p className="small" style={{ margin: 0 }}>Remove this car? Its documents are deleted too.</p>
        <div className="row">
          <button type="button" className="btn-o danger" disabled={busy} onClick={() => void act(true)}>{busy ? 'Removing' : 'Remove'}</button>
          <button type="button" className="textbtn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </div>
    ) : (
      <div className="row">
        <button type="button" className="textbtn" disabled={busy || changed} onClick={() => void act(false)}>Mark sold</button>
        <button type="button" className="textbtn" disabled={busy || changed} onClick={() => setConfirming(true)}>Remove</button>
      </div>
    )}
    {changed && <p role="status" className="small">Updated. Reporting the final sale price is optional.</p>}
    {error && <p className="err" role="alert">{error}</p>}
  </div>;
}
