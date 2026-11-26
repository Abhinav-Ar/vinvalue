import Link from 'next/link';
import { LogoMark } from './Logo';

/** Site footer: one quiet line plus sources. */
export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div className="foot-main">
          <Link className="logo" href="/" aria-label="AutoIQ home"><LogoMark /><span>AutoIQ</span></Link>
          <nav aria-label="Footer" className="foot-links">
            <Link href="/appraise">Appraise</Link>
            <Link href="/garage">Garage</Link>
            <Link href="/buy">Buy</Link>
            <Link href="/market">Market</Link>
          </nav>
          <p className="small foot-rev" style={{ margin: 0 }}>Estimates, not offers.</p>
        </div>
        <p className="foot-src">
          © 2026 AutoIQ. VIN data from NHTSA vPIC; sales from Washington State title records.
          {' '}3D model: <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept">Car Concept</a> by Eric Chadwick, © 2024 Darmstadt Graphics Group GmbH,
          after Unity Fan’s public-domain model, adapted under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      </div>
    </footer>
  );
}
