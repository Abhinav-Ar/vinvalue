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
 * below for the dropped wheels. Wheel centers sit at SVG (233, 261) and (743, 261) in both.
 */
const VIEWBOX = '0 -60 1000 540';
export const HERO_ASPECT = '1000 / 540';

const CALLOUTS: Callout[] = [
  { x: 84, y: 262, label: 'condition', lx: 0, ly: 150 },
  { x: 250, y: 174, label: 'powertrain, from NHTSA', lx: 140, ly: 46 },
  { x: 560, y: 104, label: 'trim + options', lx: 470, ly: 26 },
  { x: 784, y: 226, label: 'mileage + tires', lx: 790, ly: 60 },
];

const dim = { stroke: 'currentColor', strokeWidth: 0.9, fill: 'none' } as const;

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
        callouts={CALLOUTS}
        style={{ pointerEvents: 'none' }}
      >
        <g className={styles.hud}>
          <g className="f" style={{ animationDelay: '1.8s' }} {...dim}>
            <path d="M233 312 L233 374 M743 312 L743 374" strokeDasharray="3 3" />
            <path d="M233 366 L743 366 M242 362 L233 366 L242 370 M734 362 L743 366 L734 370" />
          </g>
          <text className="f dimt" style={{ animationDelay: '1.8s' }} x={488} y={359} textAnchor="middle" fontSize={12} fill="currentColor">Wheelbase 100.4 in</text>
          <g className="f" style={{ animationDelay: '2s' }} {...dim}>
            <path d="M62 312 L62 404 M938 312 L938 404" strokeDasharray="3 3" />
            <path d="M62 396 L938 396 M71 392 L62 396 L71 400 M929 392 L938 396 L929 400" />
          </g>
          <text className="f dimt" style={{ animationDelay: '2s' }} x={500} y={389} textAnchor="middle" fontSize={12} fill="currentColor">Overall length 172.0 in</text>
          <g className="f" style={{ animationDelay: '2.1s' }} {...dim}>
            <path d="M660 74 L984 74 M944 330 L984 330" strokeDasharray="3 3" />
            <path d="M974 74 L974 330 M970 83 L974 74 L978 83 M970 321 L974 330 L978 321" />
          </g>
          <text className="f dimt" style={{ animationDelay: '2.1s' }} transform="translate(992 202) rotate(-90)" textAnchor="middle" fontSize={12} fill="currentColor">Height 51.2 in</text>
        </g>
        <ExplodeLabels />
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
