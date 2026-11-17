'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/views/components/client/api';
import { longDate, usd, usdSigned } from '@/views/components/client/format';
import { EmptyState, ErrorNote, Skeleton } from '@/views/components/ui';

type Item = {
  id: string;
  code: string | null;
  createdAt: string;
  vehicle: string;
  vehicleId: string | null;
  route: 'instant' | 'private' | 'retail' | 'trade';
  value: number;
  change: number | null;
  shareSlug: string;
};
type Vehicle = { id: string; label: string; nickname: string | null };

const ROUTE: Record<Item['route'], string> = { instant: 'Instant', private: 'Private', retail: 'Retail', trade: 'Trade-in' };

export function HistoryPage() {
  const { data, error, reload } = useApi<{ items: Item[] }>('/api/appraisals');
  const vehicles = useApi<{ vehicles: Vehicle[] }>(data ? '/api/vehicles' : null);
  const [car, setCar] = useState<string>('all');

  // Filter only by cars that have appraisals here; hide the control when there is one or none.
  const cars = (vehicles.data?.vehicles ?? []).filter((v) => data?.items.some((i) => i.vehicleId === v.id));
  const rows = (data?.items ?? []).filter((i) => car === 'all' || i.vehicleId === car);

  return (
    <section className="wrap page">
      <h1 className="title">Appraisal history</h1>
      <p className="lede" style={{ marginTop: 16, maxWidth: 620 }}>
        Every appraisal you have run, with a link to its report.
      </p>

      {error ? (
        <div style={{ marginTop: 36 }}>
          <ErrorNote error={error} onRetry={reload} />
        </div>
      ) : !data ? (
        <div className="sheet" style={{ marginTop: 36, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} h={22} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div style={{ marginTop: 36 }}>
          <EmptyState
            text="Appraisals you run while signed in will be listed here, each with a link to its report."
            action={
              <Link className="btn" href="/appraise">
                Appraise a car
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {cars.length > 1 && (
            <div className="segs" role="group" aria-label="Filter by vehicle" style={{ marginTop: 36, display: 'inline-flex', flexWrap: 'wrap' }}>
              {[{ id: 'all', name: 'All' }, ...cars.map((v) => ({ id: v.id, name: v.nickname || v.label }))].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={car === o.id ? 'seg on' : 'seg'}
                  aria-pressed={car === o.id}
                  onClick={() => setCar(o.id)}
                  style={{ flex: '0 0 auto' }}
                >
                  {o.name}
                </button>
              ))}
            </div>
          )}
          <div className="sheet" style={{ marginTop: cars.length > 1 ? 24 : 36, padding: '8px 8px 0' }}>
            <div className="scroll-x" tabIndex={0} role="region" aria-label="Report history table">
              <table className="tbl">
                <caption className="sr">Your appraisals, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Report</th>
                    <th scope="col">Date</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Route</th>
                    <th scope="col" className="num">Value</th>
                    <th scope="col" className="num">Change</th>
                    <th scope="col"><span className="sr">Link</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.code ?? '–'}</td>
                      <td className="mono">{longDate(r.createdAt)}</td>
                      <td>{r.vehicle}</td>
                      <td>{ROUTE[r.route]}</td>
                      <td className="num">{usd(r.value)}</td>
                      <td className="num">{r.change === null ? 'New' : r.change === 0 ? '$0' : usdSigned(r.change)}</td>
                      <td>
                        <Link href={`/report/${r.shareSlug}`} aria-label={`Open report ${r.code ?? ''} for ${r.vehicle}`.replace('  ', ' ')}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
