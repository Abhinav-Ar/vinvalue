'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, useApi } from '@/views/components/client/api';
import { EmptyState, ErrorNote, Skeleton } from '@/views/components/ui';
import { NotificationSettings, type PrefsView } from './NotificationSettings';

type AlertType = 'recall' | 'maintenance' | 'value' | 'price_target' | 'renewal' | 'market';
type Filter = 'all' | 'unread' | AlertType;
type AlertItem = {
  id: string;
  type: AlertType;
  vehicle: { id: string; label: string; badge: string } | null;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};
type AlertsResponse = { items: AlertItem[]; unreadCount: number; nextCursor: string | null };
type VehiclesResponse = { vehicles: { id: string }[] };

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'recall', label: 'Recalls' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'value', label: 'Value' },
  { value: 'price_target', label: 'Price targets' },
  { value: 'renewal', label: 'Renewals' },
  { value: 'market', label: 'Market' },
];
const TYPE_LABEL: Record<AlertType, string> = {
  recall: 'Recalls',
  maintenance: 'Maintenance',
  value: 'Value',
  price_target: 'Price targets',
  renewal: 'Renewals',
  market: 'Market',
};
const BADGE = ['bdg b1', 'bdg b2', 'bdg b3'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 min ago", "2 h ago", "Yesterday", "Nov 9" in the viewer's local time. */
function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const sameDay = d.toDateString() === now.toDateString();
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (sameDay) return `${Math.floor(mins / 60)} h ago`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  const s = `${MON[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? s : `${s}, ${d.getFullYear()}`;
}

function alertsChanged() {
  window.dispatchEvent(new Event('alerts:changed'));
}

export function AlertsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const path = `/api/alerts${filter === 'all' ? '' : `?filter=${filter}`}`;
  const { data, error, loading, reload, setData } = useApi<AlertsResponse>(path);
  const vehicles = useApi<VehiclesResponse>('/api/vehicles');
  const prefs = useApi<PrefsView>('/api/notification-prefs');
  const [actionError, setActionError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => setActionError(null), [filter]);

  /** Badge fill style follows the garage order (createdAt), like the calendar: b1 filled, b2 outline, b3 dotted. */
  const badgeClass = useMemo(() => {
    const m = new Map<string, string>();
    vehicles.data?.vehicles.forEach((v, i) => m.set(v.id, BADGE[i % 3]!));
    return m;
  }, [vehicles.data]);

  async function markRead(id: string) {
    setActionError(null);
    try {
      await api(`/api/alerts/${id}/read`, { method: 'PATCH' });
      setData((d) => {
        if (!d) return d;
        const was = d.items.find((i) => i.id === id);
        const items = filter === 'unread' ? d.items.filter((i) => i.id !== id) : d.items.map((i) => (i.id === id ? { ...i, read: true } : i));
        return { ...d, items, unreadCount: was && !was.read ? Math.max(d.unreadCount - 1, 0) : d.unreadCount };
      });
      alertsChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not mark the alert as read. Try again.');
    }
  }

  async function markAll() {
    setActionError(null);
    try {
      await api('/api/alerts/read-all', { method: 'POST' });
      setData((d) => (d ? { ...d, unreadCount: 0, items: filter === 'unread' ? [] : d.items.map((i) => ({ ...i, read: true })) } : d));
      alertsChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not mark alerts as read. Try again.');
    }
  }

  async function loadMore() {
    if (!data?.nextCursor) return;
    setMore(true);
    setActionError(null);
    try {
      const sep = path.includes('?') ? '&' : '?';
      const next = await api<AlertsResponse>(`${path}${sep}cursor=${encodeURIComponent(data.nextCursor)}`);
      setData((d) => (d ? { items: [...d.items, ...next.items], unreadCount: next.unreadCount, nextCursor: next.nextCursor } : next));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Could not load older alerts. Try again.');
    } finally {
      setMore(false);
    }
  }

  /** Alert types with in-app turned off are hidden by the API; say so instead of a bare empty list. */
  const mutedFilter = filter !== 'all' && filter !== 'unread' && filter !== 'recall' && prefs.data?.matrix[filter].in_app === false;

  if (error?.status === 401) {
    return (
      <section className="wrap page">
        <h1 className="title">Alerts</h1>
        <div style={{ marginTop: 24 }}>
          <ErrorNote error={error} />
        </div>
      </section>
    );
  }

  return (
    <section className="wrap page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="title">Alerts</h1>
          <p className="small" style={{ margin: '8px 0 0', minHeight: 20 }} aria-live="polite">
            {data ? `${data.unreadCount} unread` : loading ? <Skeleton w={72} h={16} /> : null}
          </p>
        </div>
        <button type="button" className="btn-o" onClick={markAll} disabled={!data || data.unreadCount === 0}>
          Mark all as read
        </button>
      </div>

      <div className="segs" role="group" aria-label="Filter alerts" style={{ marginTop: 28, display: 'inline-flex', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={f.value === filter ? 'seg on' : 'seg'}
            aria-pressed={f.value === filter}
            onClick={() => setFilter(f.value)}
            style={{ flex: '0 0 auto' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="g2" style={{ marginTop: 24, alignItems: 'start', gridTemplateColumns: 'minmax(0,7fr) minmax(0,5fr)' }}>
        <div>
          {actionError && (
            <p className="err" role="alert" style={{ marginBottom: 12 }}>
              {actionError}
            </p>
          )}
          {error ? (
            <ErrorNote error={error} onRetry={reload} />
          ) : !data ? (
            <div className="sheet" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
                  <Skeleton w={20} h={20} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton w={80} h={12} />
                    <Skeleton w="70%" h={20} />
                    <Skeleton w="90%" h={14} />
                  </div>
                  <Skeleton w={48} h={14} />
                </div>
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState
              text={
                filter === 'all'
                  ? 'No alerts yet. Recalls, maintenance due dates, value changes, price targets, renewals and market moves for your cars will appear here.'
                  : filter === 'unread'
                    ? 'No unread alerts. New ones will appear here.'
                    : mutedFilter
                      ? `${TYPE_LABEL[filter as AlertType]} alerts are turned off for in-app. Turn on the In-app box in notification settings to see them here.`
                      : `No ${TYPE_LABEL[filter as AlertType].toLowerCase()} alerts yet. They will appear here when something changes.`
              }
              action={
                filter === 'all' ? (
                  <Link className="btn" href="/garage">
                    Go to your garage
                  </Link>
                ) : (
                  <button type="button" className="btn-o" onClick={() => setFilter('all')}>
                    Show all alerts
                  </button>
                )
              }
            />
          ) : (
            <div className="sheet">
              {data.items.map((it) => (
                <article
                  key={it.id}
                  style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 14, alignItems: 'start', padding: '18px 20px', borderBottom: '1px solid var(--line)' }}
                >
                  {it.vehicle ? (
                    <span className={badgeClass.get(it.vehicle.id) ?? 'bdg b3'} title={it.vehicle.label} aria-hidden="true">
                      {it.vehicle.badge}
                    </span>
                  ) : it.type === 'price_target' ? (
                    <span className="bdg b3" aria-hidden="true">$</span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="label" style={{ fontSize: 11 }}>
                        {TYPE_LABEL[it.type]}
                        {it.vehicle && <span className="sr">, {it.vehicle.label}</span>}
                      </span>
                      {!it.read && (
                        <span className="small" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          New
                        </span>
                      )}
                    </div>
                    {it.link ? (
                      <Link
                        href={it.link}
                        onClick={() => {
                          if (!it.read) void api(`/api/alerts/${it.id}/read`, { method: 'PATCH' }).then(alertsChanged, () => {});
                        }}
                        style={{ display: 'block', marginTop: 6, fontSize: 18, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none' }}
                      >
                        {it.title}
                      </Link>
                    ) : (
                      <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 500 }}>{it.title}</p>
                    )}
                    <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                      {it.body}
                    </p>
                    {it.type === 'recall' && !it.body.includes('may apply to your model year') && (
                      <p className="small" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                        Recalls may apply to your model year without affecting your car. Check your VIN at nhtsa.gov/recalls.
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: 10 }}>
                    <time className="mono small" dateTime={it.createdAt}>
                      {when(it.createdAt)}
                    </time>
                    {!it.read && (
                      <button type="button" className="ghost" onClick={() => markRead(it.id)} style={{ fontSize: 13 }} aria-label={`Mark read: ${it.title}`}>
                        Mark read
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {data.nextCursor && (
                <div style={{ padding: '16px 20px' }}>
                  <button type="button" className="btn-o" onClick={loadMore} disabled={more}>
                    {more ? 'Loading older alerts' : 'Show older alerts'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <NotificationSettings prefs={prefs} onInAppChanged={() => { void reload(); alertsChanged(); }} />
      </div>
    </section>
  );
}
