'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { CarDrawing, type CarParts } from '@/components/CarDrawing';
import styles from './landing.module.css';

/**
 * Scroll progress 0..1 for the "How we get to the number" section. A source (not a prop value) so
 * the car can update every frame without React re-rendering. A 3D canvas swapped in later
 * (next/dynamic) takes the same props and reads the same source.
 */
export type ProgressSource = { get(): number; subscribe(cb: () => void): () => void };

/** Box ratio matches the drawing's viewBox (1000 x 540). */
export const EXPLODE_ASPECT = '1000 / 540';

/** Step 1 until a third of the way, then 2, then 3. */
export const stepOf = (p: number): 1 | 2 | 3 => (p < 1 / 3 ? 1 : p < 2 / 3 ? 2 : 3);
/** Progress values for the three still states (reduced motion, narrow screens). */
export const STILL_PROGRESS = [1 / 3, 2 / 3, 1] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Phase 1 lifts the glass, phase 2 moves the wheels out, phase 3 drops them. Each eased with smoothstep. */
function vars(p: number) {
  const lift = smooth(p * 3);
  const out = smooth(p * 3 - 1);
  const down = smooth(p * 3 - 2);
  return { '--xg': (-78 * lift).toFixed(2), '--xo': (46 * out).toFixed(2), '--xd': (84 * down).toFixed(2) };
}

const PARTS: CarParts = {
  glass: { transform: 'translateY(calc(var(--xg, 0) * 1px))' },
  frontWheel: { transform: 'translate(calc(var(--xo, 0) * -1px), calc(var(--xd, 0) * 1px))' },
  rearWheel: { transform: 'translate(calc(var(--xo, 0) * 1px), calc(var(--xd, 0) * 1px))' },
};

export function ExplodeCar({ progress }: { progress: number | ProgressSource }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof progress === 'number') return;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const p = progress.get();
      for (const [k, v] of Object.entries(vars(p))) el.style.setProperty(k, v);
      const s = String(stepOf(p));
      if (el.dataset.step !== s) el.dataset.step = s;
    };
    apply();
    return progress.subscribe(apply);
  }, [progress]);

  const p0 = typeof progress === 'number' ? progress : 0;
  return (
    <div ref={ref} className={styles.explode} style={vars(p0) as CSSProperties} data-step={stepOf(p0)}>
      <CarDrawing
        variant="gt"
        viewBox="0 -70 1000 540"
        ink={false}
        parts={PARTS}
        label="Line drawing of a coupe taken apart: the glass lifts for the VIN decode, the wheels move out for local listings and drop for mileage, title and history"
      >
        <g fill="var(--blue)" stroke="var(--blue)">
          <g className={`${styles.lab} ${styles.l1}`}>
            <text className="hand" x={560} y={-34} stroke="none">VIN decode</text>
            <path d="M600 -28 L600 2" fill="none" />
          </g>
          <g className={`${styles.lab} ${styles.l2}`}>
            <text className="hand" x={250} y={132} stroke="none">Local listings</text>
          </g>
          <g className={`${styles.lab} ${styles.l3}`}>
            <text className="hand" x={40} y={452} stroke="none">Mileage, title, history</text>
            <path d="M150 432 L172 400" fill="none" />
          </g>
        </g>
      </CarDrawing>
    </div>
  );
}
