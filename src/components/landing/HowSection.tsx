'use client';
import { useSyncExternalStore } from 'react';
import { ExplodeCar, STILL_PROGRESS } from './ExplodeCar';
import styles from './landing.module.css';

const STEPS = [
  { title: 'Identify the exact car', body: 'The VIN gives us year, make, model, trim and drivetrain from NHTSA records.' },
  { title: 'Compare with local listings', body: 'Comparable listings near your ZIP, outliers removed, each weighted by how close its mileage sits to yours.' },
  { title: 'Show each adjustment', body: 'Mileage, condition, title and accident history each change the number by an amount listed in the report.' },
];

/** Under reduced motion the hero car stays assembled, so this section shows the three stills instead. */
const STILL_QUERY = '(prefers-reduced-motion: reduce)';
function useStill() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(STILL_QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(STILL_QUERY).matches,
    () => false,
  );
}

export function HowSection() {
  return useStill() ? <HowStill /> : <HowSteps />;
}

/** The car at the top of the page acts the steps out while scrolling; here they are spelled out. */
function HowSteps() {
  return (
    <section className="wrap" aria-labelledby="how-h" style={{ marginTop: 96 }}>
      <h2 id="how-h" className="h2">How we get to the number</h2>
      <ol className={`g3 ${styles.steps}`} style={{ gap: 32 }}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.step}>
            <span className={`mono ${styles.stepNum}`}>{i + 1}</span>
            <div><h3>{s.title}</h3><p>{s.body}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HowStill() {
  return (
    <section className="wrap" aria-labelledby="how-h" style={{ marginTop: 120 }}>
      <h2 id="how-h" className="h2">How we get to the number</h2>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={`g2 ${styles.stillRow}`}>
            <div className={styles.step} style={{ borderTop: 0, padding: 0 }}>
              <span className={`mono ${styles.stepNum}`}>{i + 1}</span>
              <div><h3>{s.title}</h3><p>{s.body}</p></div>
            </div>
            <ExplodeCar progress={STILL_PROGRESS[i]} />
          </li>
        ))}
      </ol>
    </section>
  );
}
