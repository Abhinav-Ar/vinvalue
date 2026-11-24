import Link from 'next/link';
import { FloorPlan } from '@/views/components/landing/FloorPlan';
import { HeroStage } from '@/views/components/landing/HeroCar';
import { HowSection } from '@/views/components/landing/HowSection';
import { Reveal } from '@/views/components/Reveal';
import { RouteDiagram } from '@/views/components/RouteDiagram';
import { Waterfall } from '@/views/components/Waterfall';
import { SAMPLE_VIN } from '@/views/components/VinInput';
import styles from '@/views/components/landing/landing.module.css';
import home from '@/views/components/landing/home.module.css';

const SOURCES = [
  ['VIN decode', 'NHTSA vPIC'],
  ['Market evidence', 'Recorded sales and a calibrated price model'],
  ['Cost', 'Free, no account needed'],
  ['Method', 'Every adjustment itemized'],
];

const EVIDENCE = [
  ['Decoded vehicle', 'Year, make, model, trim and drivetrain from the VIN.'],
  ['Market evidence', 'Each recorded sale on a price-against-mileage chart.'],
  ['Itemized math', 'Every adjustment from the starting value, in dollars.'],
  ['Honest range', 'Why the range is as wide as it is, and what you told us that we could not check.'],
];

// Example figures (static copy, not from the API).
const SAMPLE_STEPS = [
  { key: 'miles', label: 'Mileage below average', amount: 650 },
  { key: 'cond', label: 'Condition, good', amount: 0 },
  { key: 'acc', label: 'One minor accident', amount: -900 },
];

const FAQ = [
  ['Where is my VIN?', 'On the driver side of the dashboard where it meets the windshield, on the driver door jamb sticker, or on your registration and insurance cards. It is 17 characters and never uses I, O or Q.'],
  ['Where do the prices come from?', 'Where we have them, recorded sales of the same model from Washington State title records. Otherwise a price model built from the car’s original MSRP, its age, mileage and collector demand, calibrated against real asking prices. The report says which one it used.'],
  ['Is this a guaranteed offer?', 'No. It is an estimate. Real offers depend on inspection, local demand and what each buyer requires.'],
  ['Why three values?', 'Each way of selling carries different costs, effort and risk, so each one lands at a different price.'],
  ['Do I need an account?', 'Not to get a value. Sign in with Google to save cars to your garage and keep a history of every report.'],
];

const COMPS: [number, number][] = [[167.7, 62.8], [134.4, 58.6], [98.1, 92.1], [399.3, 106.6], [384.8, 121.9], [184.4, 59.4], [141.7, 61.3], [451.4, 133.3], [411, 120.8], [150.2, 101.5], [198, 102.8], [421.5, 153.8], [432, 116.2], [346.5, 104.8], [278.4, 93.1], [107.5, 45.5], [454.4, 126.9], [194, 98.7], [443.8, 170.8], [418.8, 148.9], [279.4, 121.7], [247.7, 82.7], [137, 80.3], [88.5, 29.2]];

function SecHead({ idx, title, id, aside }: { idx: string; title: string; id: string; aside?: React.ReactNode }) {
  return (
    <div className="sec-head">
      <span className="idx">{idx}</span>
      <span className="rule" />
      <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 24, flexWrap: 'wrap' }}>
        <h2 id={id} className="h2" style={{ maxWidth: 760 }}>{title}</h2>
        {aside}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="grid" style={{ paddingBottom: 1 }}>
      <section className="wrap" style={{ paddingTop: 72 }}>
        <div className="g2" style={{ alignItems: 'end' }}>
          <div>
            <p className="kicker">Free car valuation · Sheet 01</p>
            <h1 className="h1">See what your car is worth, and why</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p className="lede">AutoIQ decodes your VIN, weighs recorded sales and a calibrated price model, and itemizes every adjustment it makes.</p>
            <form action="/appraise" method="get" className={styles.vinRow}>
              <label className="sr" htmlFor="vin-hero">Vehicle identification number</label>
              <input id="vin-hero" name="vin" className="inp vin" placeholder="17-character VIN" maxLength={17} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
              <button type="submit" className="btn">Find my value <span className="arr" aria-hidden="true">→</span></button>
            </form>
            <p className="small" style={{ margin: 0 }}>Free, no account needed. <Link href="/appraise">Where is my VIN?</Link></p>
          </div>
        </div>
        <HeroStage plan={<FloorPlan />} />
        <div className="sheet frame g4" style={{ marginTop: 8 }}>
          {SOURCES.map(([k, v]) => (
            <div key={k} className="cell"><p className="kicker">{k}</p><p style={{ margin: '8px 0 0' }}>{v}</p></div>
          ))}
        </div>
      </section>

      <HowSection />

      <section className="wrap" style={{ marginTop: 120 }} aria-labelledby="routes-h">
        <SecHead idx="02" id="routes-h" title="Your price depends on how you sell" aside={<p className="small" style={{ margin: 0 }}>Example figures, not an offer</p>} />
        <Reveal>
          <div className="sheet" style={{ marginTop: 32, padding: '28px 32px 24px' }}>
            <RouteDiagram instant={23100} private={27450} retail={31900} low={25400} high={29600} />
          </div>
        </Reveal>
      </section>

      <section className="wrap" style={{ marginTop: 120 }} aria-labelledby="evidence-h">
        <SecHead idx="03" id="evidence-h" title="Each estimate comes with its evidence" />
        <div className="g2" style={{ marginTop: 32, alignItems: 'start', gap: 40 }}>
          <div>
            <p className="lede">Every report has a link you can send to a buyer or dealer, and it stays in your history.</p>
            <ol className={home.evidence}>
              {EVIDENCE.map(([t, d], i) => (
                <li key={t}><span className="mono">{String(i + 1).padStart(2, '0')}</span><div><h3>{t}</h3><p>{d}</p></div></li>
              ))}
            </ol>
            <Link className="btn" href={`/appraise?vin=${SAMPLE_VIN}`}>Try it with a sample VIN <span className="arr" aria-hidden="true">→</span></Link>
          </div>
          <Reveal>
            <div className="sheet frame" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <p className="kicker" style={{ color: 'var(--blue)' }}>Private sale estimate</p>
                <span className="tag on"><i />24 recorded sales</span>
              </div>
              <p className="mono" style={{ margin: '12px 0 18px', fontSize: 56, letterSpacing: '-.04em', lineHeight: 1 }}>$27,450</p>
              <svg viewBox="0 0 520 200" width="100%" role="img" aria-label="Sample scatter plot of 24 recorded sale prices against mileage. Price falls as mileage rises, and the sample car sits near the trend line on the lower-mileage side." style={{ display: 'block', margin: '6px 0 18px' }}>
                <g stroke="var(--line)" strokeWidth={1}>
                  {[48, 124, 200, 276, 352, 428, 504].map((x) => <path key={`x${x}`} d={`M${x} 16 L${x} 172`} />)}
                  {[16, 47.2, 78.4, 109.6, 140.8, 172].map((y) => <path key={`y${y}`} d={`M48 ${y} L504 ${y}`} />)}
                </g>
                <path d="M48 172 L504 172 M48 16 L48 172" stroke="var(--ink)" strokeWidth={1} />
                <path d="M48.0 49.5 L504.0 152.5" stroke="var(--mid)" strokeDasharray="5 4" strokeWidth={1.2} />
                {COMPS.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={5} fill="none" stroke="var(--ink)" strokeWidth={1.3} />)}
                <path d="M206.3 87.0 L242.3 87.0 M224.3 69.0 L224.3 105.0" stroke="var(--blue)" strokeWidth={1.5} />
                <circle cx={224.3} cy={87} r={8} fill="var(--blue)" />
                <text x={236} y={76} className="hand" fill="var(--blue)">your car</text>
                <text x={504} y={192} textAnchor="end" fontSize={11} fill="var(--mid)">Mileage →</text>
              </svg>
              <Waterfall base={{ label: 'Median of 24 sales', amount: 27700 }} steps={SAMPLE_STEPS} total={{ label: 'Private sale estimate', amount: 27450 }} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 120 }} aria-labelledby="garage-h">
        <div className="sheet g2" style={{ padding: 40, alignItems: 'center', gridTemplateColumns: '7fr 5fr' }}>
          <GarageSheet />
          <div>
            <p className="kicker">Garage</p>
            <h2 id="garage-h" className="h2">Track value and upkeep for every car you own</h2>
            <p style={{ color: 'var(--mid)', lineHeight: 1.6, fontSize: 17 }}>Save a car once, then refresh its value whenever you like. You also get service reminders and recall checks.</p>
            <Link className="btn-o" href="/garage" style={{ marginTop: 8 }}>Open your garage <span className="arr" aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="wrap g2" style={{ marginTop: 120, gridTemplateColumns: '4fr 8fr' }} aria-labelledby="faq-h">
        <div>
          <p className="kicker">04</p>
          <h2 id="faq-h" className="h2">Common questions</h2>
        </div>
        <div style={{ borderBottom: '1px solid var(--line)' }}>
          {FAQ.map(([q, a], i) => (
            <details key={q} className="note" open={i === 0}>
              <summary style={{ minHeight: 44, alignItems: 'center' }}>{q}</summary>
              <p style={{ marginLeft: 0 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wrap" style={{ marginTop: 120, marginBottom: 32 }}>
        <div className="sheet frame" style={{ padding: '56px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <p className="kicker">Before you talk to a buyer or dealer</p>
          <h2 className="h2" style={{ maxWidth: 760 }}>Know your number, and the reasons behind it</h2>
          <Link className="btn" href="/appraise" style={{ marginTop: 12 }}>Find my value <span className="arr" aria-hidden="true">→</span></Link>
        </div>
      </section>
    </div>
  );
}

/** Static illustration of a garage entry: value trend, next service and recall check. Example data. */
function GarageSheet() {
  const pts = [32, 30.8, 30.1, 29.2, 28.6, 28.1, 27.6, 27.45];
  const x = (i: number) => 20 + i * (380 / (pts.length - 1));
  const y = (v: number) => 20 + ((33 - v) / 6) * 110;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <div className={home.garageSheet} role="img" aria-label="Example garage entry: a 2019 coupe whose value has eased from $32,000 to $27,450 over two years, with an oil change due in 600 miles and no open recalls.">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>2019 Coupe GT</p>
        <p className="mono" style={{ margin: 0, color: 'var(--blue)', fontSize: 22 }}>$27,450</p>
      </div>
      <svg viewBox="0 0 420 150" width="100%" aria-hidden="true" style={{ display: 'block', margin: '12px 0' }}>
        {[20, 47.5, 75, 102.5, 130].map((g) => <path key={g} d={`M20 ${g} L400 ${g}`} stroke="var(--line)" />)}
        <path d={`${d} L400 130 L20 130 Z`} fill="var(--soft)" />
        <path d={d} fill="none" stroke="var(--blue)" strokeWidth={2} />
        {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="var(--paper)" stroke="var(--blue)" strokeWidth={1.5} />)}
        <text x={20} y={146} fontSize={11} fill="var(--mid)">2024</text>
        <text x={400} y={146} fontSize={11} fill="var(--mid)" textAnchor="end">Today</text>
      </svg>
      <div className="g2" style={{ gap: 12 }}>
        <div className={home.garageChip}><span className="kicker">Next service</span><span>Oil change in 600 mi</span></div>
        <div className={home.garageChip}><span className="kicker">Recalls</span><span>None open</span></div>
      </div>
    </div>
  );
}
