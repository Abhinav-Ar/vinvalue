'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { CarDrawing, type CarParts } from '@/views/components/CarDrawing';
import styles from './landing.module.css';

/**
 * Scroll progress 0..1 for the car explode. A source (not a prop value) so the car can update
 * every frame without React re-rendering. The hero's 3D canvas reads the same source.
 */
export type ProgressSource = { get(): number; subscribe(cb: () => void): () => void };

/** One value, many readers. `set` notifies subscribers only on change. */
export function createProgressSource(): ProgressSource & { set(v: number): void } {
  let value = 0;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    set: (v) => { if (v !== value) { value = v; subs.forEach((cb) => cb()); } },
  };
}

/** Box ratio matches the drawing's viewBox (1000 x 540). */
export const EXPLODE_ASPECT = '1000 / 540';

/** Step 1 until a third of the way, then 2, then 3. */
export const stepOf = (p: number): 1 | 2 | 3 => (p < 1 / 3 ? 1 : p < 2 / 3 ? 2 : 3);
/** Progress values for the three still states (reduced motion, no WebGL). */
export const STILL_PROGRESS = [1 / 3, 2 / 3, 1] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Phase 1 lifts the glass, phase 2 moves the wheels out, phase 3 drops them. Same math as the 3D car. */
export function explodePhases(p: number) {
  return { lift: smooth(p * 3), out: smooth(p * 3 - 1), down: smooth(p * 3 - 2) };
}

export function explodeVars(p: number) {
  const { lift, out, down } = explodePhases(p);
  return { '--phase0': String(lift), '--phase1': String(out), '--phase2': String(down), '--xg': (-78 * lift).toFixed(2), '--xo': (92 * out).toFixed(2), '--xd': (84 * down).toFixed(2) };
}

export const EXPLODE_PARTS: CarParts = {
  glass: { transform: 'translateY(calc(var(--xg, 0) * 1px))' },
  frontWheel: { transform: 'translate(calc(var(--xo, 0) * -1px), 0px)' },
  rearWheel: { transform: 'translateY(calc(var(--xd, 0) * 1px))' },
};

/** The three step labels, in drawing coordinates. Lit by data-step on an ancestor. */
export const anchors = [
  { x: 560, y: 90, lx: 550, ly: -32, label: 'VIN decode' },
  { x: 233, y: 261, lx: 320, ly: 466, label: 'Market evidence' },
  { x: 743, y: 261, lx: 785, ly: 442, label: 'Vehicle history' },
];

export function ExplodeLabels({ projected = false }: { projected?: boolean }) {
  return <g stroke="var(--blue)" fill="var(--blue)">
    {anchors.map(({ x, y, lx, ly, label }, i) => {
      const dx = i === 0 ? 36 : i === 1 ? 18 : 114;
      const dy = i === 0 ? -54 : i === 2 ? 112 : 70;
      return <g key={label} className={`${styles.lab} ${[styles.l1, styles.l2, styles.l3][i]}`}>
        <g className={styles.svgGuide} transform={`translate(${x} ${y})`}>
          <line x2={i === 1 ? -92 : 0} y2={i === 0 ? -78 : i === 2 ? 84 : 0}
            strokeDasharray="4 5" vectorEffect="non-scaling-stroke"
            style={{ transform: `scale(var(--phase${i}, 0))` }} />
        </g>
        <line data-guide={i} x1={x} y1={y} x2={x} y2={y} strokeDasharray="4 5" opacity=".65" />
        <path data-leader={i} fill="none" display={projected ? undefined : 'none'} />
        {projected && <>
          <text x={lx} y={ly} className={styles.projectedLabel} textAnchor="middle" stroke="none">{label}</text>
        </>}
        <g data-anchor={i} style={EXPLODE_PARTS[(['glass','frontWheel','rearWheel'] as const)[i]]}>
          <g transform={`translate(${x} ${y})`}>
            <circle r="2.8" />
            {!projected && <><path d={`M0 0 l${dx} ${dy} h${i === 2 ? -4 : 14}`} fill="none" />
            <text textAnchor={i === 2 ? 'middle' : 'start'} x={i === 2 ? dx - 4 : dx + 18} y={dy + 4} stroke="none" style={{letterSpacing: 0, fontFamily: "var(--font-sans), sans-serif"}} fontSize="16">{label}</text></>}
          </g>
        </g>
      </g>;
    })}
  </g>;
}

/** Line drawing taken apart at a fixed progress (the still steps) or following a source. */
export function ExplodeCar({ progress }: { progress: number | ProgressSource }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof progress === 'number') return;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const p = progress.get();
      for (const [k, v] of Object.entries(explodeVars(p))) el.style.setProperty(k, v);
      const s = String(stepOf(p));
      if (el.dataset.step !== s) el.dataset.step = s;
    };
    apply();
    return progress.subscribe(apply);
  }, [progress]);

  const p0 = typeof progress === 'number' ? progress : 0;
  return (
    <div ref={ref} className={styles.explode} style={explodeVars(p0) as CSSProperties} data-step={Math.ceil(p0 * 3)}>
      <CarDrawing
        variant="gt"
        viewBox="0 -70 1000 540"
        ink={false}
        parts={EXPLODE_PARTS}
        label="Line drawing of a coupe taken apart: the glass lifts for the VIN decode, the wheels move out to show market evidence and vehicle history"
      >
        <ExplodeLabels />
      </CarDrawing>
    </div>
  );
}
