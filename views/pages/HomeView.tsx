import Link from 'next/link';
import { CarDrawing } from '@/views/components/CarDrawing';
import { DriveStage } from '@/views/components/landing/DriveStage';
import { VinForm } from '@/views/components/landing/VinForm';
import { Reveal } from '@/views/components/Reveal';
import { Waterfall } from '@/views/components/Waterfall';
import { SAMPLE_VIN } from '@/views/components/VinInput';
import s from '@/views/components/landing/drive.module.css';

// Example figures (static copy, not from the API).
const SAMPLE_STEPS = [
  { key: 'miles', label: 'Mileage below average', amount: 650 },
  { key: 'cond', label: 'Condition, good', amount: 0 },
  { key: 'acc', label: 'One minor accident', amount: -900 },
];

const LOT = [
  { variant: 'crossover', name: 'Model X', value: '$52,300' },
  { variant: 'roadster', name: 'MX-5 Miata', value: '$19,800' },
  { variant: 'truck', name: 'F-150', value: '$33,600' },
] as const;

const FAQ = [
  ['Where is my VIN?', 'At the base of the windshield on the driver side, on the door jamb sticker, or on your registration. 17 characters.'],
  ['Where do prices come from?', 'Recorded sales of the same model from Washington State title records when we have them. Otherwise a price model calibrated on real listings. The report says which.'],
  ['Is this an offer?', 'No. It is an estimate. Real offers depend on inspection and local demand.'],
  ['Do I need an account?', 'Not for a value. Sign in with Google to keep a garage and report history.'],
];

export default function Home() {
  return (
    <>
      <DriveStage />

      <section className={`wrap ${s.section}`} aria-labelledby="math-h">
        <div className={s.split}>
          <div>
            <p className="kicker">Every report</p>
            <h2 id="math-h" className="title">The math, in the open.</h2>
            <p className="lede">Each adjustment, in dollars, from the market to your number.</p>
            <Link className="btn-o" href={`/appraise?vin=${SAMPLE_VIN}`}>Try a sample VIN <span className="arr" aria-hidden="true">→</span></Link>
          </div>
          <Reveal>
            <Waterfall base={{ label: 'Median of 24 sales', amount: 27700 }} steps={SAMPLE_STEPS} total={{ label: 'Private sale estimate', amount: 27450 }} />
          </Reveal>
        </div>
      </section>

      <section className={`wrap ${s.section}`} aria-labelledby="garage-h">
        <p className="kicker">Garage</p>
        <h2 id="garage-h" className="title" style={{ marginTop: 'var(--s3)' }}>Every car you own, kept current.</h2>
        <Reveal>
          <div className={s.lot}>
            {LOT.map((c) => (
              <figure key={c.name}>
                <CarDrawing variant={c.variant} ink={false} />
                <figcaption><span>{c.name}</span><span>{c.value}</span></figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
        <div className="row" style={{ marginTop: 'var(--s5)', justifyContent: 'space-between' }}>
          <p className="small" style={{ margin: 0 }}>Values, service reminders and recalls in one place.</p>
          <Link className="btn-o" href="/garage">Open garage <span className="arr" aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className={`wrap ${s.section}`} aria-labelledby="faq-h">
        <div className={s.faq}>
          <h2 id="faq-h" className="title">Questions</h2>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            {FAQ.map(([q, a]) => (
              <details key={q} className="note">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`wrap ${s.closing}`} aria-labelledby="closing-h">
        <h2 id="closing-h" className="display">Know your number.</h2>
        <VinForm id="vin-closing" />
      </section>
    </>
  );
}
