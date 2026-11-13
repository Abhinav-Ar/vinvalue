'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ExplodeCar, STILL_PROGRESS, stepOf, type ProgressSource } from './ExplodeCar';
import styles from './landing.module.css';

const STEPS = [
  { title: 'Identify the exact car', body: 'The VIN gives us year, make, model, trim and drivetrain from NHTSA records.' },
  { title: 'Compare with local listings', body: 'Comparable listings near your ZIP, outliers removed, each weighted by how close its mileage sits to yours.' },
  { title: 'Show each adjustment', body: 'Mileage, condition, title and accident history each change the number by an amount listed in the report.' },
];

/** Still layout when the user asked for reduced motion, or the screen is too narrow for a sticky stage. */
const STILL_QUERY = '(prefers-reduced-motion: reduce), (max-width: 820px)';
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
  const still = useStill();
  return still ? <HowStill /> : <HowScroll />;
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

function HowScroll() {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // One progress value, many readers; updated in requestAnimationFrame while the section is near view.
  const source = useMemo(() => {
    let value = 0;
    const subs = new Set<() => void>();
    return {
      get: () => value,
      subscribe: (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; },
      set: (v: number) => { if (v !== value) { value = v; subs.forEach((cb) => cb()); } },
    } satisfies ProgressSource & { set(v: number): void };
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - (stage.current?.offsetHeight ?? window.innerHeight);
      const raw = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      // Same window as the design: the explode runs between 10% and 75% of the pinned scroll.
      const p = Math.min(1, Math.max(0, (raw - 0.1) / 0.65));
      source.set(p);
      setStep(stepOf(p));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    let listening = false;
    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();
      } else {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    };
    const io = new IntersectionObserver(([e]) => { listen(e.isIntersecting); if (!e.isIntersecting) measure(); }, { rootMargin: '200px 0px' });
    io.observe(el);
    measure();
    return () => { io.disconnect(); listen(false); if (frame) cancelAnimationFrame(frame); };
  }, [source]);

  return (
    <section ref={track} className={styles.howTrack} aria-labelledby="how-h">
      <div ref={stage} className={`wrap g2 ${styles.howStage}`}>
        <div>
          <h2 id="how-h" className="h2">How we get to the number</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => {
              const on = step === i + 1;
              return (
                <li key={s.title} className={`${styles.step} ${on ? styles.stepOn : styles.stepOff}`} aria-current={on ? 'step' : undefined}>
                  <span className={`mono ${styles.stepNum}`}>{i + 1}</span>
                  <div><h3>{s.title}</h3><p>{s.body}</p></div>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <ExplodeCar progress={source} />
        </div>
      </div>
    </section>
  );
}
