'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const LINKS = [
  { href: '/appraise', label: 'Appraise', match: ['/appraise', '/report'] },
  { href: '/garage', label: 'Garage', match: ['/garage'] },
  { href: '/buy', label: 'Buy', match: ['/buy'] },
  { href: '/market', label: 'Market', match: ['/market'] },
];

type Me = { signedIn: boolean; name?: string | null };

export function Nav() {
  const path = usePathname() ?? '/';
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuRef.current?.focus(); } }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [open]);

  // Pages dispatch 'alerts:changed' after marking alerts read so the badge stays in sync.
  useEffect(() => {
    const refresh = () =>
      fetch('/api/alerts')
        .then((r) => (r.ok ? r.json() : null))
        .then((a) => a && setUnread(a.unreadCount ?? 0))
        .catch(() => {});
    window.addEventListener('alerts:changed', refresh);
    return () => window.removeEventListener('alerts:changed', refresh);
  }, []);

  useEffect(() => {
    let live = true;
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((m: Me) => {
        if (!live) return;
        setMe(m);
        if (m.signedIn)
          fetch('/api/alerts')
            .then((r) => (r.ok ? r.json() : null))
            .then((a) => live && a && setUnread(a.unreadCount ?? 0))
            .catch(() => {});
      })
      .catch(() => live && setMe({ signedIn: false }));
    return () => {
      live = false;
    };
  }, [path]);

  return (
    <header className={`nav${open ? ' menu-open' : ''}`}>
      <Logo />
      <button ref={menuRef} type="button" className="nav-menu" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Menu'}</button>
      <nav id="main-nav" className="links" aria-label="Main">
        {LINKS.map((l) => {
          const on = l.match.some((m) => path === m || path.startsWith(m + '/'));
          return (
            <Link key={l.href} href={l.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
              {l.label}
            </Link>
          );
        })}
        {me && !me.signedIn && <Link className="signin-m" href="/sign-in">Sign in</Link>}
        {me?.signedIn && <Link className="signin-m" href="/history">History</Link>}
      </nav>
      <div className="navr">
        {me?.signedIn && (
          <Link
            className="ghost"
            href="/alerts"
            aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
            style={{ textDecoration: 'none', position: 'relative' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M4 13 L4 8 C4 5 6 3 9 3 C12 3 14 5 14 8 L14 13 L15.5 14.5 L2.5 14.5 Z M7 16 C7.5 17 10.5 17 11 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
            {!!unread && (
              <span className="kicker" style={{ color: 'var(--blue)' }}>
                {unread}
              </span>
            )}
          </Link>
        )}
        <ThemeToggle />
        {me?.signedIn ? (
          <Link className="ghost signin" href="/history">
            History
          </Link>
        ) : (
          <Link className="btn-o signin" href="/sign-in" style={{ visibility: me ? 'visible' : 'hidden' }}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
