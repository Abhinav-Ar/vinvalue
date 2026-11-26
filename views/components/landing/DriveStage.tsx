'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CarDrawing } from '@/views/components/CarDrawing';
import { Drive3D, useCan3D } from '@/views/components/car3d/useCan3D';
import type { Progress } from '@/views/components/car3d/DriveCanvas';
import { VinForm } from './VinForm';
import s from './drive.module.css';

/** Where each chapter peaks on the journey (matches the camera stops in DriveCanvas). */
const PEAKS = [0, 0.25, 0.5, 0.75, 1];
const RAIL = ['Outside', 'Decode', 'Market', 'Inside', 'Value'];

/** The sun drifts with the camera, then fills the windshield once you are inside. [left vw, top vh, scale] */
const SUN: [number, number, number, number][] = [
  [0, 72, 22, 1],
  [0.25, 22, 20, 0.8],
  [0.5, 64, 16, 0.7],
  [0.75, 50, 20, 1.5],
  [1, 50, 26, 2.1],
];
/** Phones: text sits at the top and the car at the bottom, so the sun keeps to the middle band. */
const SUN_NARROW: typeof SUN = [
  [0, 76, 50, 0.8],
  [0.25, 24, 52, 0.7],
  [0.5, 72, 50, 0.7],
  [0.75, 50, 56, 1.3],
  [1, 50, 33, 1.7],
];

function createProgress(): Progress & { set: (v: number) => void } {
  let value = 0;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(v) { if (v === value) return; value = v; subs.forEach((f) => f()); },
    subscribe(f) { subs.add(f); return () => { subs.delete(f); }; },
  };
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The landing journey. A tall track pins a full-screen stage; scrolling flies the camera from
 * outside the car into the driver's seat while five short chapters fade in and out. Under
 * reduced motion the chapters simply stack (CSS) and the line drawing stands in for the 3D car.
 */
export function DriveStage() {
  const track = useRef<HTMLElement>(null);
  const chapters = useRef<(HTMLDivElement | null)[]>([]);
  const sun = useRef<HTMLDivElement>(null);
  const drawing = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const can3D = useCan3D();
  const progress = useMemo(() => createProgress(), []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? clamp(-r.top / travel) : 0;
      progress.set(p);
      PEAKS.forEach((peak, i) => {
        const node = chapters.current[i];
        if (!node) return;
        const d = p - peak;
        const o = clamp(1 - (Math.abs(d) - 0.045) / 0.075);
        node.style.opacity = String(o);
        node.style.transform = `translate3d(0, ${(-d * 260).toFixed(1)}px, 0)`;
        node.toggleAttribute('data-on', o > 0.5);
      });
      setCurrent(PEAKS.reduce((best, peak, i) => (Math.abs(p - peak) < Math.abs(p - PEAKS[best]!) ? i : best), 0));
      const path = window.innerWidth < 820 ? SUN_NARROW : SUN;
      let j = 0;
      while (j < path.length - 2 && p > path[j + 1]![0]) j++;
      const [a0, x0, y0, k0] = path[j]!, [a1, x1, y1, k1] = path[j + 1]!;
      const t = clamp((p - a0) / (a1 - a0));
      const e = t * t * (3 - 2 * t);
      if (sun.current) sun.current.style.transform = `translate3d(calc(${x0 + (x1 - x0) * e}vw - 50%), calc(${y0 + (y1 - y0) * e}vh - 50%), 0) scale(${k0 + (k1 - k0) * e})`;
      if (drawing.current) drawing.current.style.transform = `scale(${1 + p * 1.4})`;
      // The cabin recedes behind the final number so it reads.
      if (canvas.current) canvas.current.style.setProperty('--fade', String(1 - 0.6 * clamp((p - 0.85) / 0.12)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [progress]);

  const live = can3D && !failed;
  const set = (i: number) => (node: HTMLDivElement | null) => { chapters.current[i] = node; };

  return (
    <section ref={track} className={s.track} aria-label="How AutoIQ values a car">
      <div className={s.stage} data-ready={live && ready ? 'true' : 'false'}>
        <div ref={sun} className={s.sun} aria-hidden="true" />
        <div className={s.drawing} aria-hidden="true">
          <div ref={drawing} className={s.drawingInner}><CarDrawing variant="gt" ink={false} /></div>
        </div>
        {live && <div ref={canvas} className={s.canvas}><Drive3D progress={progress} onReady={() => setReady(true)} onFail={() => setFailed(true)} /></div>}

        <div ref={set(0)} className={`${s.chapter} ${s.left} ${s.hero}`} data-on="">
          <h1 className="display">What is your car worth?</h1>
          <p className="lede">A value you can defend, with every adjustment shown.</p>
          <VinForm id="vin-hero" />
          <p className={`kicker ${s.cue}`}>Scroll to get in</p>
        </div>
        <div ref={set(1)} className={`${s.chapter} ${s.right}`}>
          <p className="kicker">01 · Decode</p>
          <h2 className="title">Seventeen characters.</h2>
          <p className="lede">The VIN gives us year, make, model, trim and drivetrain.</p>
        </div>
        <div ref={set(2)} className={`${s.chapter} ${s.left}`}>
          <p className="kicker">02 · Market</p>
          <h2 className="title">Every sale like yours.</h2>
          <p className="lede">Recorded sales of the same model, or a price model calibrated on real listings.</p>
        </div>
        <div ref={set(3)} className={`${s.chapter} ${s.top}`}>
          <p className="kicker">03 · Your car</p>
          <h2 className="title">Then the details.</h2>
          <p className="lede">Miles, condition, title, accidents. Each one priced.</p>
        </div>
        <div ref={set(4)} className={`${s.chapter} ${s.center} ${s.final}`}>
          <p className="kicker">Private sale · example</p>
          <p className={s.value}>$27,450</p>
          <dl className={s.routes}>
            <div><dt className="kicker">Instant offer</dt><dd>$23,100</dd></div>
            <div><dt className="kicker">Dealer retail</dt><dd>$31,900</dd></div>
          </dl>
          <Link className="btn" href="/appraise">Find my value <span className="arr" aria-hidden="true">→</span></Link>
        </div>

        <ol className={s.rail} aria-hidden="true">
          {RAIL.map((label, i) => <li key={label} data-on={i === current || undefined}><span>{label}</span></li>)}
        </ol>
      </div>
    </section>
  );
}
