'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CarDrawing, type Callout } from '@/views/components/CarDrawing';
import { Car3D, useCan3D } from '@/views/components/car3d/useCan3D';
import { PART_INFO, type PartId } from '@/views/components/car3d/parts';
import { createProgressSource, EXPLODE_PARTS, ExplodeLabels, explodeVars, stepOf, type ProgressSource } from './ExplodeCar';
import { STEPS } from './HowSection';
import styles from './landing.module.css';

/**
 * Frame shared by the drawing and the 3D canvas: the car plus room above for the lifted glass and
 * below for the dropped wheels. The SVG and WebGL versions use separate dimension marks for their resting views.
 */
const VIEWBOX = '0 -60 1000 540';
export const HERO_ASPECT = '1000 / 540';

const CALLOUTS: Callout[] = [
  { x: 84, y: 262, label: 'condition', lx: 0, ly: 150 },
  { x: 250, y: 174, label: 'powertrain, from NHTSA', lx: 140, ly: 46 },
  { x: 560, y: 104, label: 'trim + options', lx: 470, ly: 26 },
  { x: 784, y: 226, label: 'mileage + tires', lx: 790, ly: 60 },
];
// Resting orthographic projection of the fascia, engine casting, canopy and rear tyre.
const CALLOUTS_3D: Callout[] = [
  { ...CALLOUTS[0], x: 112, y: 282 },
  { ...CALLOUTS[1], x: 178, y: 243 },
  { ...CALLOUTS[2], x: 560, y: 121 },
  { ...CALLOUTS[3], x: 785, y: 214 },
];

const dim = { stroke: 'currentColor', strokeWidth: 0.9, fill: 'none' } as const;

// Dimension marks in SVG units. The imported car is 4.357 m long with a 2.800 m wheelbase.
function Dimension({ x1, x2, y1, y2, y, label, delay, transform }: {
  x1: number; x2: number; y1: number; y2: number; y: number;
  label: string; delay: string; transform?: string;
}) {
  return <g transform={transform}>
    <g className="f" style={{ animationDelay: delay }} {...dim}>
      <path d={`M${x1} ${y1} V${y + 8} M${x2} ${y2} V${y + 8}`} strokeDasharray="3 3" />
      <path d={`M${x1} ${y} H${x2} M${x1 + 9} ${y - 4} l-9 4 9 4 M${x2 - 9} ${y - 4} l9 4 -9 4`} />
    </g>
    <text className="f dimt" style={{ animationDelay: delay }} x={(x1 + x2) / 2} y={y - 7}
      textAnchor="middle" fontSize={12} fill="currentColor">{label}</text>
  </g>;
}

/** Explode window inside the pinned scroll (fraction of the pin travel). */
const EXPLODE_FROM = 0.06;
const EXPLODE_TO = 0.78;

/**
 * Landing hero art: floor plan backdrop plus the car. With motion allowed the art pins while the
 * page scrolls and the car comes apart in three steps (the same steps as "How we get to the
 * number"). The 3D car can be turned and its parts selected; without WebGL the line drawing does
 * the same explode; under reduced motion nothing pins and the drawing stays assembled.
 */
export function HeroStage(_props: { plan?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const source = useMemo(() => createProgressSource(), []);

  useEffect(() => {
    const el = track.current;
    const a = art.current;
    if (!el || !a) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const travel = el.offsetHeight - a.offsetHeight;
      if (travel <= 0) { source.set(0); return; }
      const top = parseFloat(getComputedStyle(a).top) || 0;
      const raw = Math.min(1, Math.max(0, (top - el.getBoundingClientRect().top) / travel));
      source.set(Math.min(1, Math.max(0, (raw - EXPLODE_FROM) / (EXPLODE_TO - EXPLODE_FROM))));
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    motion.addEventListener('change', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const unsubscribe = source.subscribe(() => setStep(stepOf(source.get())));
    measure();
    return () => {
      unsubscribe();
      motion.removeEventListener('change', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [source]);

  return (
    <div ref={track} className={styles.heroTrack}>
      <div ref={art} className={styles.heroArt}>

        <div className={styles.heroCarSlot}><HeroCar progress={source} /></div>
        <ol className={styles.rail} aria-label="How we get to the number">
          {STEPS.map(({ title, body }, i) => <li key={title} aria-current={step === i + 1 ? 'step' : undefined}>
            <span className="mono">0{i + 1}</span><div><h3>{title}</h3><p>{body}</p></div>
          </li>)}
        </ol>
      </div>
      {/* Scroll room for the pin (zero height under reduced motion). A sticky element cannot travel into padding. */}
      <div className={styles.heroSpacer} aria-hidden />
    </div>
  );
}

function HeroCar({ progress }: { progress: ProgressSource }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const can3d = useCan3D();
  const [failed, setFailed] = useState(false);
  const use3d = can3d && !failed;
  useEffect(() => { if (!use3d) setReady(false); }, [use3d]);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [turned, setTurned] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [look, setLookState] = useState<'xray' | 'solid'>('xray');
  // Remember the viewer's choice of look (a convenience; falls back to x-ray).
  useEffect(() => {
    try { if (localStorage.getItem('autoiq-car-look') === 'solid') setLookState('solid'); } catch { /* storage blocked */ }
  }, []);
  const chooseLook = (l: 'xray' | 'solid') => {
    setLookState(l);
    try { localStorage.setItem('autoiq-car-look', l); } catch { /* storage blocked */ }
  };
  const quiet = useRef({ turned: false, selected: false });
  quiet.current = { turned, selected: !!selected };

  // Scroll progress drives the drawing's CSS vars, the lit step label and whether the dimension notes show.
  useEffect(() => {
    const apply = () => {
      const el = box.current;
      if (!el) return;
      const p = progress.get();
      for (const [k, v] of Object.entries(explodeVars(p))) el.style.setProperty(k, v);
      const step = p < 0.03 ? '0' : String(stepOf(p));
      if (el.dataset.step !== step) el.dataset.step = step;
      const hud = p < 0.03 && !quiet.current.turned && !quiet.current.selected ? 'on' : 'off';
      if (el.dataset.hud !== hud) el.dataset.hud = hud;
    };
    apply();
    return progress.subscribe(apply);
  }, [progress, turned, selected]);

  const info = selected ? PART_INFO[selected] : null;
  return (
    <div
      ref={box}
      className={styles.carBox}
      style={{ aspectRatio: HERO_ASPECT, ...(explodeVars(0) as CSSProperties) }}
      data-ready={ready && use3d}
      data-step="0"
      data-hud="on"
      {...(use3d
        ? { tabIndex: 0, role: 'group', 'aria-label': 'AIQ-01 concept coupe in 3D. Drag or use the arrow keys to turn it; click a part to see what it changes in the value.' }
        : {})}
    >
      {use3d && (
        <Car3D
          viewBox={VIEWBOX}
          progress={progress}
          onReady={() => setReady(true)}
          look={look}
          resetKey={resetKey}
          keyTarget={box}
          onSelect={setSelected}
          onTurned={setTurned}
          onFail={() => setFailed(true)}
        />
      )}
      <CarDrawing
        variant="gt"
        ink={false}
        parts={EXPLODE_PARTS}
        viewBox={VIEWBOX}
        hudClassName={styles.hud}
        label={use3d ? undefined : 'The AIQ-01 concept coupe, with its dimensions'}
        callouts={ready ? CALLOUTS_3D : CALLOUTS}
        style={{ pointerEvents: 'none' }}
      >
        <g className={styles.hud}>
          <Dimension delay="1.8s" {...(ready
            ? { x1: 331, x2: 784, y1: 360, y2: 332, y: 392, label: 'Wheelbase 110.2 in' }
            : { x1: 233, x2: 743, y1: 312, y2: 312, y: 366, label: 'Wheelbase 100.4 in' })} />
          <Dimension delay="2s" {...(ready
            ? { x1: 84, x2: 862, y1: 330, y2: 330, y: 422, label: 'Overall length 171.6 in' }
            : { x1: 62, x2: 938, y1: 312, y2: 312, y: 396, label: 'Overall length 172.0 in' })} />
          <Dimension delay="2.1s" transform="rotate(-90)" {...(ready
            ? { x1: -335, x2: -117, y1: 849, y2: 570, y: 927, label: 'Height 45.2 in' }
            : { x1: -330, x2: -74, y1: 944, y2: 660, y: 974, label: 'Height 51.2 in' })} />
        </g>
        <ExplodeLabels projected={ready} />
      </CarDrawing>

      {use3d && (
        <div className={styles.carUi}>
          <div className={styles.partCard} aria-live="polite">
            {info ? (
              <>
                <p className="label" style={{ color: 'var(--blue)' }}>{info.name}</p>
                <p className="small" style={{ margin: '6px 0 0', color: 'var(--ink)' }}>{info.note}</p>
              </>
            ) : (
              <p className="small" style={{ margin: 0 }}>Drag to rotate · Select a part to inspect</p>
            )}
          </div>
          <div className={styles.carActions}>
            {(turned || selected) && (
              <button type="button" className="btn-o" onClick={() => setResetKey((k) => k + 1)}>Reset view</button>
            )}
            <div className={styles.looks} role="group" aria-label="How the car is drawn">
              {(['xray', 'solid'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={look === l} className={look === l ? styles.lookOn : undefined} onClick={() => chooseLook(l)}>
                  {l === 'xray' ? 'X-ray' : 'Solid'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
