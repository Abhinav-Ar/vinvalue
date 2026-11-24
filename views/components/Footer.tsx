import Link from 'next/link';
import { LogoMark } from './Logo';

/** Site footer, drawn as the title block in the corner of an engineering drawing. */
export function Footer() {
  return (
    <footer className="wrap" style={{ paddingTop: 72, paddingBottom: 40 }}>
      <div className="tblock">
        <div>
          <p className="kicker">Drawn by</p>
          <Link className="logo" href="/" aria-label="AutoIQ home"><LogoMark /><span>AutoIQ</span></Link>
        </div>
        <nav aria-label="Footer">
          <p className="kicker">Sheets</p>
          <p style={{ margin: 0, display: 'flex', gap: '6px 14px', flexWrap: 'wrap', fontSize: 15 }}>
            <Link href="/appraise">Appraise</Link>
            <Link href="/garage">Garage</Link>
            <Link href="/buy">Buy</Link>
            <Link href="/market">Market</Link>
          </p>
        </nav>
        <div>
          <p className="kicker">Sources</p>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>VIN data from NHTSA vPIC. Recorded sales from Washington State title records. Model estimates from original MSRP, age and mileage.</p>
        </div>
        <div>
          <p className="kicker">Rev.</p>
          <p className="small" style={{ margin: 0 }}>© 2026 AutoIQ<br />Estimates, not offers</p>
        </div>
      </div>
    </footer>
  );
}
