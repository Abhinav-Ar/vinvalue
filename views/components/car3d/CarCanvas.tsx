'use client';
/**
 * WebGL view of the AIQ-01 model. Loaded with next/dynamic (ssr: false) only; the SVG drawing
 * stays underneath as the fallback and carries the callouts and labels.
 *
 * The camera frames the same rectangle as the SVG's viewBox, so in the resting view the wheel
 * centers sit on the same pixels in both. The glass lift turns the elevation into an axonometric view.
 *
 * Interaction: drag to turn the car (touch turns it sideways only, so vertical swipes still scroll
 * the page), arrow keys turn it when focused, hover outlines a part, click selects it.
 * Scroll progress explodes the parts.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { anchors, explodePhases, type ProgressSource } from '@/views/components/landing/ExplodeCar';
import { buildCar, highlight, pickPart, setColors, setLook, type CarColors, type CarLook, type CarModel, type PartId } from './model';

export const REST = { yaw: 0, pitch: 0 };

const PITCH_RANGE = [-0.05, 0.85] as const;

export type CarCanvasProps = {
  /** SVG viewBox the canvas lines up with, e.g. "0 -60 1000 540". */
  viewBox: string;
  /** Scroll progress 0..1: 0 assembled, 1 fully apart. */
  progress?: ProgressSource;
  /** Fired after the assembled scene has been drawn. */
  onReady?: () => void;
  /** X-ray (see-through, theme colors) or solid (painted, lit by a studio environment). */
  look?: CarLook;
  /** Bump to return to the resting view and clear the selection. */
  resetKey?: number;
  /** Element that receives arrow keys (focusable). */
  keyTarget?: RefObject<HTMLElement | null>;
  onSelect?: (id: PartId | null) => void;
  /** True once the user has turned the car away from the resting view. */
  onTurned?: (turned: boolean) => void;
  onFail?: () => void;
};

export default function CarCanvas(props: CarCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div ref={host} style={{ position: 'absolute', inset: 0 }}>
      <Boundary onFail={props.onFail}>
        <Canvas
          dpr={[1, 2]}
          frameloop="demand"
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          style={{ position: 'absolute', inset: 0, touchAction: 'pan-y', cursor: 'grab' }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Scene {...props} host={host} />
        </Canvas>
      </Boundary>
    </div>
  );
}

function readColors(el: HTMLElement | null): CarColors {
  const cs = el ? getComputedStyle(el) : null;
  const get = (name: string) => {
    const token = cs?.getPropertyValue(name).trim();
    // Three ignores CSS alpha. The grid shader controls its own fade.
    return new THREE.Color(token?.replace(/rgba\(([^)]+),[^,]+\)/, 'rgb($1)') || undefined);
  };
  return { ink: get('--ink'), accent: get('--blue'), paper: get('--paper'), mid: get('--mid'), grid: get('--grid2') };
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

function Scene({ viewBox, progress, onReady, onFail, look = 'xray', resetKey, keyTarget, onSelect, onTurned, host }: CarCanvasProps & { host: RefObject<HTMLDivElement | null> }) {
  const set = useThree((s) => s.set);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const model = useMemo<CarModel>(() => buildCar(readColors(host.current)), [host]);
  useEffect(() => {
    const el = gl.domElement;
    const lost = () => onFail?.();
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onFail]);
  const view = useRef({ yaw: REST.yaw, pitch: REST.pitch, ty: REST.yaw, tp: REST.pitch });
  const sel = useRef<{ selected: PartId | null; hovered: PartId | null }>({ selected: null, hovered: null });
  const dragged = useRef(false);
  const turned = useRef(false);
  const cb = useRef({ onSelect, onTurned, look });
  cb.current = { onSelect, onTurned, look };

  // Orthographic camera on the viewBox rectangle.
  const camera = useMemo(() => {
    const [vx, vy, vw, vh] = viewBox.split(/[\s,]+/).map(Number);
    const cx = (vx + vw / 2 - 500) / 100;
    const cy = (330 - (vy + vh / 2)) / 100;
    const hw = vw / 200;
    const hh = vh / 200;
    const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 100);
    cam.position.set(cx, cy, 30);
    cam.lookAt(cx, cy, 0);
    (cam as THREE.OrthographicCamera & { manual?: boolean }).manual = true;
    return cam;
  }, [viewBox]);

  useEffect(() => { set({ camera }); }, [camera, set]);
  useEffect(() => () => model.dispose(), [model]);

  // Theme: tokens live on .bp; re-read when html[data-theme] changes.
  useEffect(() => {
    setColors(model, readColors(host.current));
    const mo = new MutationObserver(() => { setColors(model, readColors(host.current)); invalidate(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => mo.disconnect();
  }, [model, host, invalidate]);

  useEffect(() => progress?.subscribe(() => invalidate()), [progress, invalidate]);

  // Solid look: studio reflections from a generated room environment (no files, no extra package).
  const scene = useThree((s) => s.scene);
  const env = useRef<THREE.WebGLRenderTarget | null>(null);
  useEffect(() => {
    if (look === 'solid' && !env.current) {
      const pm = new THREE.PMREMGenerator(gl);
      const room = new RoomEnvironment();
      env.current = pm.fromScene(room, 0.04);
      room.dispose();
      pm.dispose();
    }
    scene.environment = look === 'solid' ? env.current?.texture ?? null : null;
    setLook(model, look);
    invalidate();
  }, [look, gl, scene, model, invalidate]);
  useEffect(() => () => { env.current?.dispose(); env.current = null; }, []);

  const actions = useRef({
    setTurned: (t: boolean) => { if (t !== turned.current) { turned.current = t; cb.current.onTurned?.(t); } },
    select: (id: PartId | null) => {
      if (sel.current.selected === id) return;
      sel.current.selected = id;
      highlight(model, id, sel.current.hovered);
      cb.current.onSelect?.(id);
      invalidate();
    },
  }).current;

  // Drag to turn. Pointer capture keeps the drag going outside the canvas.
  useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; yaw: number; pitch: number; mouse: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, yaw: view.current.ty, pitch: view.current.tp, mouse: e.pointerType === 'mouse' };
      dragged.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      if (!dragged.current) { dragged.current = true; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; }
      view.current.ty = drag.yaw + dx * 0.008;
      if (drag.mouse) view.current.tp = clamp(drag.pitch + dy * 0.006, PITCH_RANGE);
      actions.setTurned(true);
      invalidate();
    };
    const up = () => { drag = null; el.style.cursor = 'grab'; };
    const key = (e: KeyboardEvent) => {
      const step = ({ ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] } as Record<string, number[]>)[e.key];
      if (!step) return;
      e.preventDefault();
      view.current.ty += step[0];
      view.current.tp = clamp(view.current.tp + step[1], PITCH_RANGE);
      actions.setTurned(true);
      invalidate();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    const k = keyTarget?.current;
    k?.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      k?.removeEventListener('keydown', key);
    };
  }, [gl, keyTarget, invalidate, actions]);

  // Reset to the resting view (skips the first run).
  const seenReset = useRef(resetKey);
  useEffect(() => {
    if (seenReset.current === resetKey) return;
    seenReset.current = resetKey;
    view.current.ty = REST.yaw;
    view.current.tp = REST.pitch;
    actions.select(null);
    actions.setTurned(false);
    invalidate();
  }, [resetKey, actions, invalidate]);

  const labels = useRef<SVGGElement[]>([]);
  const guides = useRef<SVGLineElement[]>([]);
  const projected = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    labels.current = Array.from(keyTarget?.current?.querySelectorAll<SVGGElement>('[data-anchor]') ?? []);
    guides.current = Array.from(keyTarget?.current?.querySelectorAll<SVGLineElement>('[data-guide]') ?? []);
    return () => labels.current.forEach(label => label.style.removeProperty('--projected'));
  }, [keyTarget]);
  const ready = useRef(false);
  const holder = useRef<THREE.Group>(null);
  // The car turns around its own middle, not the ground origin.
  const tmp = useMemo(() => ({ e: new THREE.Euler(), m: new THREE.Matrix4(), t: new THREE.Matrix4(), pivot: new THREE.Vector3(-0.1, 1.0, 0) }), []);

  useFrame(({ camera: activeCamera }) => {
    if (activeCamera !== camera) return;
    let again = false;
    const p = progress?.get() ?? 0;
    const { lift, out, down } = explodePhases(p);
    model.parts.glass.position.y = 0.78 * lift;
    model.parts.internals.position.y = 0.12 * lift;
    model.parts.frontWheel.position.set(-0.92 * out, 0, 0);
    model.parts.rearWheel.position.set(0, -0.84 * down, 0);
    // Ease toward the target view.
    const v = view.current;
    v.yaw += (v.ty - v.yaw) * 0.18;
    v.pitch += (v.tp - v.pitch) * 0.18;
    if (Math.abs(v.ty - v.yaw) > 1e-4 || Math.abs(v.tp - v.pitch) > 1e-4) again = true;
    else { v.yaw = v.ty; v.pitch = v.tp; }
    const g = holder.current;
    if (g) {
      const { e, m, t, pivot } = tmp;
      // At rest the pivot offset cancels out of the resting view only approximately, so rotate about the
      // origin at rest (keeps the axles on the drawing) and blend toward the pivot as the view turns away.
      const away = Math.min(1, Math.hypot(v.yaw - REST.yaw, v.pitch - REST.pitch) * 2);
      e.set(v.pitch + 0.24 * lift, v.yaw + 0.31 * lift, 0);
      m.makeTranslation(pivot.x * away, pivot.y * away, 0)
        .multiply(t.makeRotationFromEuler(e))
        .multiply(t.makeTranslation(-pivot.x * away, -pivot.y * away, 0));
      // In the exploded cutaway, remove the far tires to expose each intact axle.
      const facing = Math.cos(v.yaw + 0.31 * lift);
      for (const axle of [model.parts.frontWheel, model.parts.rearWheel]) {
        for (const wheel of axle.children) {
          if (wheel instanceof THREE.Group) wheel.visible = look === 'solid' || p < 0.03 || facing * wheel.position.z >= 0;
        }
      }
      g.matrix.copy(m);
      g.updateMatrixWorld(true);
      anchors.forEach(({ x, y }, i) => {
        const part = [model.parts.glass, model.parts.frontWheel, model.parts.rearWheel][i];
        const project = (moved: boolean) => {
          projected.set((x - 500) / 100, (330 - y) / 100, i === 0 ? 0.58 : Math.sign(facing) * part.children[0].position.z);
          if (moved) projected.add(part.position);
          projected.applyMatrix4(g.matrixWorld).project(camera);
          return [(projected.x + 1) * 500, (1 - projected.y) * 270 - 60];
        };
        const [ox, oy] = project(false);
        const [px, py] = project(true);
        if (labels.current[i]) labels.current[i].style.setProperty('--projected', `translate(${px - x}px, ${py - y}px)`);
        const guide = guides.current[i];
        if (guide) for (const [attr, value] of Object.entries({ x1: ox, y1: oy, x2: px, y2: py })) guide.setAttribute(attr, String(value));
      });
    }
    gl.render(scene, camera);
    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }
    if (again) invalidate();
  }, 1);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (dragged.current) return;
    const id = pickPart(e.intersections.map((i) => i.object), cb.current.look);
    if (id !== sel.current.hovered) {
      sel.current.hovered = id;
      highlight(model, sel.current.selected, id);
      gl.domElement.style.cursor = id ? 'pointer' : 'grab';
      invalidate();
    }
  };
  const onOut = () => {
    if (!sel.current.hovered) return;
    sel.current.hovered = null;
    highlight(model, sel.current.selected, null);
    gl.domElement.style.cursor = 'grab';
    invalidate();
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (dragged.current) return;
    e.stopPropagation();
    const id = pickPart(e.intersections.map((i) => i.object), cb.current.look);
    actions.select(id === sel.current.selected ? null : id);
  };

  useEffect(() => {
    set({ onPointerMissed: () => { if (!dragged.current) actions.select(null); } });
  }, [set, actions]);

  return (
    <group ref={holder} matrixAutoUpdate={false} onPointerMove={onMove} onPointerOut={onOut} onClick={onClick}>
      <primitive object={model.root} />
      {look === 'solid' && (
        <>
          <ambientLight intensity={0.35} />
          <directionalLight position={[3, 6, 5]} intensity={1.4} />
          <directionalLight position={[-4, 3, -3]} intensity={0.5} />
        </>
      )}
    </group>
  );
}

class Boundary extends Component<{ onFail?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}
