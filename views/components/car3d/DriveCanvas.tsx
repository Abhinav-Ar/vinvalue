'use client';
/**
 * Landing journey: a perspective camera flies around the ghosted Car Concept model and into the
 * driver's seat as the page scrolls. Loaded with next/dynamic (ssr: false); the line drawing in
 * DriveStage covers loading and the no-WebGL case.
 *
 * Model space: nose toward -x, roof toward +y, driver (left-hand drive) toward +z.
 */
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SHELL_LAYER, buildCar, setColors, setLook, type CarColors, type CarModel } from './model';

export type Progress = { get: () => number; subscribe: (fn: () => void) => () => void };

type Key = { at: number; pos: [number, number, number]; look: [number, number, number]; fov: number; shift: number };

/** Camera stops. `at` is journey progress; `shift` moves the car sideways on screen (fraction of width) to leave room for text. */
export const KEYS: Key[] = [
  { at: 0, pos: [-8.8, 2.7, 10.6], look: [-0.5, 0.95, 0], fov: 30, shift: 0.25 },
  { at: 0.25, pos: [-0.4, 1.2, 13.5], look: [-0.4, 0.95, 0], fov: 30, shift: -0.23 },
  { at: 0.5, pos: [6, 7.2, 4.8], look: [-0.9, 0.9, 0], fov: 32, shift: 0.21 },
  { at: 0.75, pos: [1.3, 2.35, 0.14], look: [-4, 1.25, 0.12], fov: 56, shift: 0 },
  { at: 1, pos: [-0.3, 1.62, 0.12], look: [-6, 1.22, 0.12], fov: 62, shift: 0 },
];

const ease = (t: number) => t * t * (3 - 2 * t);

export default function DriveCanvas({ progress, onReady, onFail }: { progress: Progress; onReady?: () => void; onFail?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div ref={host} style={{ position: 'absolute', inset: 0 }}>
      <Boundary onFail={onFail}>
        <Canvas
          dpr={[1, 1.75]}
          frameloop="demand"
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <Scene progress={progress} host={host} onReady={onReady} onFail={onFail} />
        </Canvas>
      </Boundary>
    </div>
  );
}

function readColors(el: HTMLElement | null): CarColors {
  const cs = el ? getComputedStyle(el) : null;
  const get = (name: string) => new THREE.Color(cs?.getPropertyValue(name).trim() || undefined);
  return { ink: get('--ink'), accent: get('--blue'), paper: get('--paper') };
}

function Scene({ progress, host, onReady, onFail }: { progress: Progress; host: RefObject<HTMLDivElement | null>; onReady?: () => void; onFail?: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const set = useThree((s) => s.set);
  const invalidate = useThree((s) => s.invalidate);
  const asset = useLoader(GLTFLoader, '/models/concept.glb', (loader) => loader.setMeshoptDecoder(MeshoptDecoder));
  const model = useMemo<CarModel>(() => {
    const m = buildCar(asset.scene, readColors(host.current));
    setLook(m, 'xray');
    return m;
  }, [asset, host]);
  useEffect(() => () => model.dispose(), [model]);

  const camera = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(30, 1, 0.03, 80);
    (cam as THREE.PerspectiveCamera & { manual?: boolean }).manual = true;
    return cam;
  }, []);
  useEffect(() => { set({ camera }); }, [camera, set]);

  useEffect(() => {
    const el = gl.domElement;
    const lost = () => onFail?.();
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onFail]);

  useEffect(() => {
    setColors(model, readColors(host.current));
    const mo = new MutationObserver(() => { setColors(model, readColors(host.current)); invalidate(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [model, host, invalidate]);

  useEffect(() => progress.subscribe(() => invalidate()), [progress, invalidate]);
  useEffect(() => { invalidate(); }, [size, invalidate]);

  const shellPass = useMemo(() => ({
    target: new THREE.WebGLRenderTarget(1, 1, { samples: 4 }),
    normals: new THREE.MeshNormalMaterial(),
    buf: new THREE.Vector2(),
  }), []);
  useEffect(() => () => { shellPass.target.dispose(); shellPass.normals.dispose(); }, [shellPass]);

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), la: new THREE.Vector3(), lb: new THREE.Vector3() }), []);
  const ready = useRef(false);

  useFrame(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1]!.at) i++;
    const k0 = KEYS[i]!, k1 = KEYS[i + 1]!;
    const t = ease(Math.min(1, Math.max(0, (p - k0.at) / (k1.at - k0.at))));
    const { a, b, la, lb } = tmp;
    camera.position.copy(a.fromArray(k0.pos).lerp(b.fromArray(k1.pos), t));
    camera.lookAt(la.fromArray(k0.look).lerp(lb.fromArray(k1.look), t));

    // Fit: keys are authored for a 16:10 frame. Narrower screens widen the lens and drop the side shift.
    const w = Math.max(1, size.width), h = Math.max(1, size.height);
    const aspect = w / h;
    const fov = k0.fov + (k1.fov - k0.fov) * t;
    const widen = aspect < 1.6 ? 1.6 / aspect : 1;
    const half = Math.min(Math.atan(Math.tan((fov * Math.PI) / 360) * widen), (fov < 50 ? 41 : 48) * (Math.PI / 180));
    camera.fov = (half * 360) / Math.PI;
    camera.aspect = aspect;
    const shift = aspect < 1 ? 0 : k0.shift + (k1.shift - k0.shift) * t;
    // On portrait screens the text sits on top, so drop the outside views lower in the frame.
    const drop = aspect < 1 ? 0.14 * (1 - Math.min(1, Math.max(0, (p - 0.5) / 0.25))) : 0;
    camera.setViewOffset(w, h, -shift * w, -drop * h, w, h);
    camera.updateProjectionMatrix();

    const { target, normals, buf } = shellPass;
    gl.getDrawingBufferSize(buf);
    target.setSize(buf.x, buf.y);
    model.paintShell.uniforms.texel.value.set(1 / buf.x, 1 / buf.y);
    model.paintShell.uniforms.mask.value = target.texture;
    camera.layers.set(SHELL_LAYER);
    scene.overrideMaterial = normals;
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    scene.overrideMaterial = null;
    camera.layers.set(0);
    gl.render(scene, camera);
    if (!ready.current) { ready.current = true; onReady?.(); }
  }, 1);

  return <primitive object={model.root} />;
}

class Boundary extends Component<{ children: ReactNode; onFail?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}
