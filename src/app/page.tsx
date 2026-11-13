import Link from 'next/link';
import { CarDrawing } from '@/components/CarDrawing';
import { FloorPlan } from '@/components/landing/FloorPlan';
import { HeroCar } from '@/components/landing/HeroCar';
import { HowSection } from '@/components/landing/HowSection';
import styles from '@/components/landing/landing.module.css';

const SOURCES = [
  ['VIN data', 'NHTSA vPIC'],
  ['Listings', 'MarketCheck, refreshed daily'],
  ['Area', '100 miles around your ZIP'],
  ['Account', 'Not needed for a value'],
];

// Example figures (static copy, not from the API). Shown at their final values: no counting up.
const ROUTES = [
  { name: 'Instant sale', value: '$23,100', lo: '$21,800', hi: '$24,300', at: '42%', body: 'Fastest route. A dealer or instant buyer takes the risk and the reconditioning cost.' },
  { name: 'Private sale', value: '$27,450', lo: '$25,400', hi: '$29,600', at: '49%', body: 'Most money, most effort. You handle the listing, test drives and paperwork.', on: true },
  { name: 'Dealer retail', value: '$31,900', lo: '$30,200', hi: '$33,500', at: '52%', body: 'What the same car costs on a lot, with prep and margin built in.' },
];

const EVIDENCE = ['VIN decoded details', 'Comparable listings on a chart', 'Your condition inputs', 'Every adjustment, itemized'];

const ADJUSTMENTS = [
  ['Median of 24 comps', '$27,900'],
  ['Mileage below average', '+$350'],
  ['Regional demand, 60601', '−$800'],
];

const FAQ = [
  ['Where is my VIN?', 'On the driver side of the dashboard where it meets the windshield, on the driver door jamb sticker, or on your registration and insurance cards. It is 17 characters and never uses I, O or Q.'],
  ['Is this a guaranteed offer?', 'No. It is an estimate built from current listings. Real offers depend on inspection, local demand and what each buyer requires.'],
  ['Why three values?', 'Each way of selling carries different costs, effort and risk, so each one lands at a different price.'],
  ['Do I need an account?', 'Not to get a value. Sign in with Google to save cars to your garage and keep a history of every report.'],
];

const COMPS: [number, number][] = [[167.7, 62.8], [134.4, 58.6], [98.1, 92.1], [399.3, 106.6], [384.8, 121.9], [184.4, 59.4], [141.7, 61.3], [451.4, 133.3], [411, 120.8], [150.2, 101.5], [198, 102.8], [421.5, 153.8], [432, 116.2], [346.5, 104.8], [278.4, 93.1], [107.5, 45.5], [454.4, 126.9], [194, 98.7], [443.8, 170.8], [418.8, 148.9], [279.4, 121.7], [247.7, 82.7], [137, 80.3], [88.5, 29.2]];

export default function Home() {
  return (
    <div className="grid" style={{ paddingBottom: 1 }}>
      <section className="wrap" style={{ paddingTop: 72 }}>
        <div className="g2" style={{ alignItems: 'end' }}>
          <div><h1 className="h1">See what your car is worth, and why</h1></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p className="lede">AutoIQ decodes your VIN, compares your car with listings near you and itemizes every adjustment it makes.</p>
            <form action="/appraise" method="get" className={styles.vinRow}>
              <label className="sr" htmlFor="vin-hero">Vehicle identification number</label>
              <input id="vin-hero" name="vin" className="inp vin" placeholder="17-character VIN" maxLength={17} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
              <button type="submit" className="btn">Find my value</button>
            </form>
            <p className="small mono" style={{ margin: 0 }}>No account needed, <Link href="/appraise">Where is my VIN?</Link></p>
          </div>
        </div>
        <div className={styles.heroArt}>
          <div className={`tilt ${styles.heroPlan}`}><FloorPlan /></div>
          <div className={styles.heroCarSlot}><HeroCar /></div>
        </div>
        <div className="sheet frame g4" style={{ marginTop: 8 }}>
          {SOURCES.map(([k, v]) => (
            <div key={k} className="cell"><p className="label">{k}</p><p style={{ margin: '6px 0 0' }}>{v}</p></div>
          ))}
        </div>
      </section>

      <HowSection />

      <section className="wrap" style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 24, flexWrap: 'wrap' }}>
          <h2 className="h2">Your price depends on how you sell</h2>
          <p className="small" style={{ margin: 0 }}>Example figures, not an offer</p>
        </div>
        <div className="g3" style={{ marginTop: 36 }}>
          {ROUTES.map((r) => (
            <article
              key={r.name}
              className="sheet"
              style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18, ...(r.on ? { borderColor: 'var(--blue)', background: 'var(--soft)' } : null) }}
            >
              <h3 className="label" style={r.on ? { color: 'var(--blue)' } : undefined}>{r.name}</h3>
              <p className="mono" style={{ margin: 0, fontSize: 44, fontWeight: 500, letterSpacing: '-.02em', color: r.on ? 'var(--blue)' : undefined }}>{r.value}</p>
              <div className="dim" aria-label={`Range ${r.lo} to ${r.hi}`}><span>{r.lo}</span><i><b style={{ left: r.at }} /></i><span>{r.hi}</span></div>
              <p style={{ margin: 0, color: 'var(--mid)', lineHeight: 1.55 }}>{r.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap g2" style={{ marginTop: 140, alignItems: 'center' }}>
        <div>
          <h2 className="h2">Each estimate comes with its evidence</h2>
          <p className="lede" style={{ marginTop: 18 }}>Every report has a link you can send to a buyer or dealer, and it stays in your history.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 32px' }}>
            {EVIDENCE.map((e) => <li key={e} style={{ fontSize: 17, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>{e}</li>)}
          </ul>
          <Link className="btn" href="/report/sample">Open the sample report</Link>
        </div>
        <div className="sheet" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p className="label">Private sale estimate</p>
            <p className="small" style={{ margin: 0 }}>Sample</p>
          </div>
          <p className="mono" style={{ margin: '10px 0 18px', fontSize: 52, letterSpacing: '-.02em' }}>$27,450</p>
          <div className="dim" aria-label="Range $25,400 to $29,600"><span>$25,400</span><i><b style={{ left: '49%' }} /></i><span>$29,600</span></div>
          <div style={{ margin: '22px 0 10px' }}>
            <svg viewBox="0 0 520 220" width="100%" role="img" aria-label="Sample scatter plot of 24 comparable listing prices against mileage. Price falls as mileage rises, and the sample car sits near the trend line on the lower-mileage side." style={{ display: 'block' }}>
              <g stroke="var(--line)" strokeWidth={1}>
                {[48, 124, 200, 276, 352, 428, 504].map((x) => <path key={`x${x}`} d={`M${x} 16 L${x} 172`} />)}
                {[16, 47.2, 78.4, 109.6, 140.8, 172].map((y) => <path key={`y${y}`} d={`M48 ${y} L504 ${y}`} />)}
              </g>
              <path d="M48 172 L504 172 M48 16 L48 172" stroke="var(--ink)" strokeWidth={1} />
              <path d="M48.0 49.5 L504.0 152.5" stroke="var(--mid)" strokeDasharray="5 4" strokeWidth={1.2} />
              {COMPS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={5} fill="none" stroke="var(--ink)" strokeWidth={1.3} />)}
              <path d="M206.3 87.0 L242.3 87.0 M224.3 69.0 L224.3 105.0" stroke="var(--blue)" strokeWidth={1.5} />
              <circle cx={224.3} cy={87} r={8} fill="var(--blue)" />
            </svg>
          </div>
          {ADJUSTMENTS.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <span>{k}</span><span className="mono">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 140 }}>
        <div className="sheet g2" style={{ padding: 40, alignItems: 'center', gridTemplateColumns: '7fr 5fr' }}>
          <div><CarDrawing variant="gt" label="Line drawing of a GT coupe" /></div>
          <div>
            <h2 className="h2">Track value and upkeep for every car you own</h2>
            <p style={{ color: 'var(--mid)', lineHeight: 1.6, fontSize: 17 }}>Save a car once, then refresh its value whenever you like. You also get service reminders and recall checks.</p>
            <Link className="btn-o" href="/garage" style={{ marginTop: 8 }}>Open your garage</Link>
          </div>
        </div>
      </section>

      <section className="wrap g2" style={{ marginTop: 140, gridTemplateColumns: '4fr 8fr' }}>
        <div><h2 className="h2">Common questions</h2></div>
        <div style={{ borderBottom: '1px solid var(--line)' }}>
          {FAQ.map(([q, a], i) => (
            <details key={q} className="note" open={i === 0}>
              <summary style={{ minHeight: 44, alignItems: 'center' }}>{q}</summary>
              <p style={{ marginLeft: 0 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 140, marginBottom: 32 }}>
        <div className="sheet" style={{ padding: 56, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <h2 className="h2" style={{ maxWidth: 760 }}>Get a value before you talk to a buyer or dealer</h2>
          <Link className="btn" href="/appraise" style={{ marginTop: 12 }}>Find my value</Link>
        </div>
      </section>
    </div>
  );
}
