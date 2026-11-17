'use client';
/**
 * Local market (design/Market): listings, medians and price spread for one of your garage cars.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { MarketView } from '@/models/market/service';
import { api, ApiError, useApi } from '@/views/components/client/api';
import { longDate, num, usd } from '@/views/components/client/format';
import { EmptyState, ErrorNote, SegmentedControl, Skeleton } from '@/views/components/ui';
import { MarketLine, PriceBuckets } from '@/views/components/charts';

type GarageCar = { id: string; label: string; nickname: string | null; zip: string };
type MarketWatch = { id: string; modelKey: string; zip: string; radiusMiles: number; thresholdPct: number };
type Radius = '25' | '50' | '100';

export function LocalMarket() {
  const garage = useApi<{ vehicles: GarageCar[] }>('/api/vehicles');
  const cars = useMemo(() => garage.data?.vehicles ?? [], [garage.data]);
  const [carId, setCarId] = useState<string | null>(null);
  const [radius, setRadius] = useState<Radius>('100');
  useEffect(() => {
    if (!carId && cars[0]) setCarId(cars[0].id);
  }, [cars, carId]);

  const market = useApi<MarketView>(carId ? `/api/market?vehicleId=${carId}&radius=${radius}` : null);
  const m = market.data;

  const watches = useApi<{ items: MarketWatch[] }>('/api/market-watches');
  const matches = useMemo(
    () => (m ? (watches.data?.items ?? []).filter((w) => w.modelKey === m.modelKey && w.zip === m.zip && w.radiusMiles === m.radiusMiles) : []),
    [watches.data, m],
  );
  const [busy, setBusy] = useState(false);
  const [watchErr, setWatchErr] = useState<ApiError | null>(null);
  const [watchStatus, setWatchStatus] = useState('');

  async function startWatch() {
    if (!m) return;
    setBusy(true);
    setWatchErr(null);
    try {
      await api('/api/market-watches', { body: { modelKey: m.modelKey, zip: m.zip, radiusMiles: m.radiusMiles, thresholdPct: 3 } });
      await watches.reload();
      setWatchStatus('Market alert set. We will send a note when the median moves more than 3%.');
    } catch (e) {
      setWatchErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }
  async function stopWatch() {
    setBusy(true);
    setWatchErr(null);
    try {
      for (const w of matches) await api(`/api/market-watches/${w.id}`, { method: 'DELETE' });
      await watches.reload();
      setWatchStatus('Market alert removed.');
    } catch (e) {
      setWatchErr(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (garage.error) {
    return (
      <section className="wrap page">
        <h1 className="title">Local market</h1>
        <div style={{ marginTop: 24 }}>
          {garage.error.status === 401 ? (
            <div className="notice" role="alert">
              <p style={{ margin: 0 }}>Sign in to see the market for the cars in your garage.</p>
              <Link className="btn" href="/sign-in" style={{ marginTop: 14 }}>Sign in</Link>
            </div>
          ) : (
            <ErrorNote error={garage.error} onRetry={garage.reload} />
          )}
        </div>
      </section>
    );
  }
  if (garage.data && cars.length === 0) {
    return (
      <section className="wrap page">
        <h1 className="title">Local market</h1>
        <div style={{ marginTop: 24 }}>
          <EmptyState text="Add a car to your garage to see listings and prices near you." action={<Link className="btn" href="/garage">Go to your garage</Link>} />
        </div>
      </section>
    );
  }

  const dom = m?.medianDaysOnMarket != null ? `${num(m.medianDaysOnMarket)} days` : null;
  const chg = m?.priceChange90d;
  const upstream = market.error?.status === 502;

  return (
    <section className="wrap page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="title">Local market</h1>
          <p className="small" style={{ margin: '8px 0 0' }}>{m ? `Listings near ${m.zip}` : ' '}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {cars.length > 0 ? (
            <SegmentedControl<string>
              label="Car"
              value={carId}
              onChange={setCarId}
              options={cars.map((c) => ({ value: c.id, label: c.nickname || c.label }))}
            />
          ) : (
            <Skeleton w={280} h={44} />
          )}
          <SegmentedControl<Radius>
            label="Radius"
            value={radius}
            onChange={setRadius}
            options={[{ value: '25', label: '25 mi' }, { value: '50', label: '50 mi' }, { value: '100', label: '100 mi' }]}
          />
        </div>
      </div>

      {market.error && (
        <div style={{ marginTop: 24 }}>
          {upstream ? (
            <div className="notice" role="alert">
              <p style={{ margin: 0 }}>The listing service didn&rsquo;t respond.</p>
              <button type="button" className="btn-o" style={{ marginTop: 14 }} onClick={market.reload}>Try again</button>
            </div>
          ) : (
            <ErrorNote error={market.error} onRetry={market.reload} />
          )}
        </div>
      )}

      <div className="sheet g4" style={{ marginTop: 32, gap: 0 }} aria-busy={market.loading}>
        {[
          { label: 'Active listings', value: m ? num(m.activeListings) : null },
          { label: 'Median asking', value: m ? usd(m.medianAsking) : null },
          { label: 'Median days listed', value: m ? (dom ?? '–') : null },
          { label: 'Price, last 90 days', value: m ? (chg == null ? '–' : `${chg > 0 ? '+' : chg < 0 ? '−' : ''}${Math.abs(chg).toFixed(1)}%`) : null },
        ].map((c) => (
          <div className="cell" key={c.label}>
            <p className="label">{c.label}</p>
            {c.value != null ? <p className="mono" style={{ margin: '6px 0 0', fontSize: 28 }}>{c.value}</p> : <Skeleton w={110} h={34} style={{ marginTop: 6 }} />}
            {c.label === 'Price, last 90 days' && m && chg == null && <p className="small" style={{ margin: '4px 0 0' }}>needs 90 days of history</p>}
          </div>
        ))}
      </div>

      <div className="g2" style={{ marginTop: 24, alignItems: 'start' }}>
        <div className="sheet" style={{ padding: 24 }}>
          <h2 className="label">Median asking price, 12 months</h2>
          {m ? <MarketLine series={m.series12} current={m.medianAsking} /> : <Skeleton h={220} style={{ marginTop: 12 }} />}
        </div>
        <div className="sheet" style={{ padding: 24 }}>
          <h2 className="label">Listings by asking price</h2>
          {m ? <PriceBuckets buckets={m.buckets} yourIndex={m.yourBucketIndex} yourValue={m.yourValue} /> : <Skeleton h={220} style={{ marginTop: 12 }} />}
        </div>
      </div>

      <div className="g3" style={{ marginTop: 24 }}>
        <div className="sheet" style={{ padding: 22 }}>
          <h2 className="label">Selling soon?</h2>
          <p style={{ lineHeight: 1.6, margin: '10px 0 0' }}>
            {dom ? `Cars priced near the median sell in about ${dom}. Listing above it usually adds weeks.` : 'Cars priced near the median sell fastest. Listing above it usually adds weeks.'}
          </p>
        </div>
        <div className="sheet" style={{ padding: 22 }}>
          <h2 className="label">Buying soon?</h2>
          <p style={{ lineHeight: 1.6, margin: '10px 0 0' }}>
            {m ? `With ${num(m.activeListings)} cars listed, you have room to compare. ` : ''}
            <Link href="/buy">Run a price check</Link> before you offer.
          </p>
        </div>
        <div className="sheet" style={{ padding: 22 }}>
          <h2 className="label">Watch this market</h2>
          <p style={{ lineHeight: 1.6, margin: '10px 0 14px' }}>
            {matches.length ? `You are watching this market within ${m?.radiusMiles} miles. We send a note when the median moves more than ${matches[0]!.thresholdPct}%.` : 'Get a monthly note when median prices move more than 3%.'}
          </p>
          {watches.error?.status === 401 ? null : matches.length ? (
            <button type="button" className="btn-o" onClick={stopWatch} disabled={busy}>{busy ? 'Removing alert' : 'Stop watching'}</button>
          ) : (
            <button type="button" className="btn-o" onClick={startWatch} disabled={busy || !m}>{busy ? 'Setting alert' : 'Set a market alert'}</button>
          )}
          <p className="small" role="status" style={{ margin: '10px 0 0', color: 'var(--ink)' }}>{watchStatus}</p>
          {watchErr && <ErrorNote error={watchErr} />}
        </div>
      </div>

      {m && (
        <p className="small mono" style={{ marginTop: 20 }}>
          Listings within {m.radiusMiles} miles of {m.zip}, as of {longDate(m.snapshotDate)}.
        </p>
      )}
    </section>
  );
}
