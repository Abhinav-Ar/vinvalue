import Link from 'next/link';
import { LogoMark } from './Logo';

export function Footer() {
  return (
    <footer className="wrap" style={{ paddingTop: 64, paddingBottom: 48 }}>
      <div className="g4" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="cell">
          <Link className="logo" href="/">
            <LogoMark />
            <span>AutoIQ</span>
          </Link>
        </div>
        <div className="cell" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/appraise">Appraise</Link>
          <Link href="/buy">Buy</Link>
          <Link href="/market">Market</Link>
        </div>
        <div className="cell">
          <p className="small" style={{ margin: 0 }}>Data from NHTSA vPIC and MarketCheck</p>
        </div>
        <div className="cell">
          <p className="small" style={{ margin: 0 }}>© 2026 AutoIQ</p>
        </div>
      </div>
    </footer>
  );
}
