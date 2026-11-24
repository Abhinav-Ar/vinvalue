/**
 * AIQ-01, the AutoIQ concept coupe, built in code. Original design: the side outline is the same
 * `gt` drawing as CarDrawing, lofted into 3D with a plan-view width curve and a superellipse
 * cross section, then detailed (lights, intakes, seams, mirrors, diffuser, wheel arches). No
 * downloaded asset, no textures.
 *
 * Units: one unit is 100 SVG units of the drawing (about 20 inches). Car space puts x along the
 * length (nose at -x, like the drawing's left), y up from the ground line, z across the width.
 * SVG point (sx, sy) maps to (sx - 500) / 100, (330 - sy) / 100. Wheel centers land exactly where
 * the drawing has them: x = -2.67 and 2.43, y = 0.69, radius 0.69.
 *
 * Two looks share one set of meshes: "xray" (fresnel shells and feature lines in theme colors) and
 * "solid" (painted body, tinted glass, rubber, metal). Each object keeps both materials in
 * userData.mat; a null material hides the object in that look.
 */
import * as THREE from 'three';
import type { PartId } from './parts';

export type { PartId } from './parts';
export type CarLook = 'xray' | 'solid';

export const SVG = { toX: (sx: number) => (sx - 500) / 100, toY: (sy: number) => (330 - sy) / 100 };
export const WHEELS = { front: { x: SVG.toX(233), y: SVG.toY(261) }, rear: { x: SVG.toX(743), y: SVG.toY(261) }, r: 0.69 };
const ARCH_R = 0.82;

type P = [number, number];
type Seg = { a: P; c1?: P; c2?: P; b: P };

/** The drawing's outer outline (gt ink path) with the arches left out; arches are cut from the loft. */
const OUTLINE: Seg[] = [
  { a: [70, 314], c1: [58, 306], c2: [54, 286], b: [58, 268] },
  { a: [58, 268], c1: [62, 252], c2: [72, 240], b: [92, 232] },
  { a: [92, 232], c1: [140, 210], c2: [180, 176], b: [240, 168] },
  { a: [240, 168], c1: [300, 162], c2: [350, 162], b: [398, 158] },
  { a: [398, 158], c1: [440, 120], c2: [480, 92], b: [522, 80] },
  { a: [522, 80], c1: [560, 72], c2: [620, 72], b: [660, 84] },
  { a: [660, 84], c1: [730, 104], c2: [800, 136], b: [860, 152] },
  { a: [860, 152], b: [916, 158] },
  { a: [916, 158], c1: [928, 166], c2: [934, 180], b: [936, 202] },
  { a: [936, 202], c1: [938, 240], c2: [936, 270], b: [930, 292] },
  { a: [930, 292], c1: [926, 304], c2: [916, 308], b: [900, 308] },
  { a: [900, 308], b: [96, 310] },
  { a: [96, 310], c1: [86, 312], c2: [78, 314], b: [70, 314] },
];

function bez(s: Seg, t: number): P {
  if (!s.c1 || !s.c2) return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  const u = 1 - t;
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    k[0] * s.a[0] + k[1] * s.c1[0] + k[2] * s.c2[0] + k[3] * s.b[0],
    k[0] * s.a[1] + k[1] * s.c1[1] + k[2] * s.c2[1] + k[3] * s.b[1],
  ];
}

const POLY: P[] = OUTLINE.flatMap((s) => Array.from({ length: 40 }, (_, i) => bez(s, i / 40)));
const XMIN = Math.min(...POLY.map((p) => p[0]));
const XMAX = Math.max(...POLY.map((p) => p[0]));

// All angular samples at one loft station share the same silhouette intersection.
const spans = new Map<number, { top: number; bot: number }>();

/** Top and bottom of the outline at SVG x (SVG y, so top < bottom). */
function span(sx: number): { top: number; bot: number } {
  const cached = spans.get(sx);
  if (cached) return cached;
  let top = Infinity;
  let bot = -Infinity;
  for (let i = 0; i < POLY.length; i++) {
    const p = POLY[i];
    const q = POLY[(i + 1) % POLY.length];
    if ((p[0] - sx) * (q[0] - sx) > 0 || p[0] === q[0]) continue;
    const y = p[1] + ((sx - p[0]) / (q[0] - p[0])) * (q[1] - p[1]);
    top = Math.min(top, y);
    bot = Math.max(bot, y);
  }
  if (top === Infinity) { const mid = (POLY[0][1] + 300) / 2; return { top: mid, bot: mid }; }
  const bounds = { top, bot };
  spans.set(sx, bounds);
  return bounds;
}

/** Beltline: where the glass house meets the body, from the cowl (398) to the deck (860). */
const BELT = { x0: 398, x1: 860, y0: 158, y1: 152 };
const belt = (sx: number) => BELT.y0 + ((sx - BELT.x0) / (BELT.x1 - BELT.x0)) * (BELT.y1 - BELT.y0);

/** Plan-view half width in SVG units (74 in wide overall), narrow at the nose, widest over the rear wheels. */
const WIDTH: P[] = [[54, 65], [80, 118], [150, 154], [233, 180], [400, 160], [560, 154], [743, 188], [880, 158], [938, 124]];
function halfWidth(sx: number) {
  for (let i = 1; i < WIDTH.length; i++) {
    const [x0, w0] = WIDTH[i - 1];
    const [x1, w1] = WIDTH[i];
    if (sx <= x1) { const t = (sx - x0) / (x1 - x0); const s = t * t * (3 - 2 * t); return w0 + (w1 - w0) * s; }
  }
  return WIDTH[WIDTH.length - 1][1];
}

const spow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

/** Body cross section: (z, svg y) for station sx and angle a (0 = +z side, pi/2 = top, pi = -z side). */
function bodySection(sx: number, a: number): P {
  const { top, bot } = span(sx);
  const roofTop = sx > BELT.x0 && sx < BELT.x1 ? Math.max(top, belt(sx)) : top;
  const h = bot - roofTop;
  const mid = (bot + roofTop) / 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const up = Math.max(0, s);
  // Boxy superellipse, pulled in toward the top (tumblehome) and slightly at the sill.
  const shoulder = Math.max(0, 1 - Math.abs(s - 0.42) * 1.8);
  const flank = 0.81 + 0.19 * shoulder - 0.19 * up * up;
  const ducktail = Math.max(0, Math.min(1, (sx - 869) / 54)) * up * 12;
  return [halfWidth(sx) * flank * spow(c, 0.42), mid - (h / 2) * spow(s, 0.73) - ducktail];
}

function glassSection(sx: number, a: number): P {
  const { top } = span(sx);
  const base = belt(sx);
  const h = Math.max(0, base - top);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const w = halfWidth(sx) * (0.71 - 0.16 * s);
  return [w * spow(c, 0.5), base - h * spow(s, 0.6)];
}

/** Point on the body surface in car space, pushed out by factor k from the section's middle. */
function surf(sx: number, a: number, k = 1): THREE.Vector3 {
  const [z, sy] = bodySection(sx, a);
  const cy = (SVG.toY(bodySection(sx, Math.PI / 2)[1]) + SVG.toY(bodySection(sx, -Math.PI / 2)[1])) / 2;
  const y = SVG.toY(sy);
  return new THREE.Vector3(SVG.toX(sx), cy + (y - cy) * k, (z / 100) * k);
}

/* ---------- geometry helpers ---------- */

/**
 * Loft: `stations` along x, `cols` points around each section. Closed sections go 0..2pi,
 * open ones 0..pi. `keep` can drop triangles (used to cut the wheel arches).
 */
function loft(st: number[], cols: number, closed: boolean, section: (sx: number, a: number) => P, keep?: (c: THREE.Vector3, n: THREE.Vector3) => boolean) {
  const pos: number[] = [];
  const idx: number[] = [];
  const ring = closed ? cols : cols + 1;
  for (const sx of st) {
    for (let j = 0; j < ring; j++) {
      const a = closed ? (j / cols) * Math.PI * 2 : (j / cols) * Math.PI;
      const [z, sy] = section(sx, a);
      pos.push(SVG.toX(sx), SVG.toY(sy), z / 100);
    }
  }
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const cen = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const tri = (a: number, b: number, c: number) => {
    if (keep) {
      va.fromArray(pos, a * 3); vb.fromArray(pos, b * 3); vc.fromArray(pos, c * 3);
      cen.copy(va).add(vb).add(vc).divideScalar(3);
      nrm.subVectors(vc, vb).cross(vb.clone().sub(va)).normalize();
      if (!keep(cen, nrm)) return;
    }
    idx.push(a, b, c);
  };
  for (let i = 0; i < st.length - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      const c = (i + 1) * ring + j;
      const d = (i + 1) * ring + ((j + 1) % ring);
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return { geometry: g, ring, positions: pos };
}

/** Stations bunched toward the ends, where the outline turns fastest. */
function stations(x0: number, x1: number, n: number) {
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); const s = 0.5 - 0.5 * Math.cos(Math.PI * t); return x0 + (x1 - x0) * (0.35 * t + 0.65 * s); });
}

/** A patch that hugs the body: x from sx0 to sx1, angle band lo(t)..hi(t) with t = 0..1 along x. */
function patch(sx0: number, sx1: number, lo: (t: number) => number, hi: (t: number) => number, k = 1.006, nx = 16, na = 10) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const t = i / nx;
    const sx = sx0 + (sx1 - sx0) * t;
    for (let j = 0; j <= na; j++) {
      const a = lo(t) + (hi(t) - lo(t)) * (j / na);
      surf(sx, a, k).toArray(pos, pos.length);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
    const a = i * (na + 1) + j;
    const b = a + 1;
    const c = a + na + 1;
    const d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const at = (v: number) => () => v;
const mirrorA = (f: (t: number) => number) => (t: number) => Math.PI - f(t);

/** A seam line on the body surface from (sx0, a0) to (sx1, a1). */
function seam(out: number[], sx0: number, a0: number, sx1: number, a1: number, n = 24) {
  let prev = surf(sx0, a0, 1.004);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = surf(sx0 + (sx1 - sx0) * t, a0 + (a1 - a0) * t, 1.004);
    out.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
    prev = p;
  }
}

/** Feature lines along a loft: chosen rows (cross sections) and chosen columns (lengthwise). */
function loftLines(positions: number[], rowsN: number, ring: number, rows: number[], cols: number[], closed: boolean) {
  const out: number[] = [];
  const pt = (i: number, j: number) => { const k = (i * ring + j) * 3; return [positions[k], positions[k + 1], positions[k + 2]]; };
  for (const i of rows) {
    const n = closed ? ring : ring - 1;
    for (let j = 0; j < n; j++) out.push(...pt(i, j), ...pt(i, (j + 1) % ring));
  }
  for (const j of cols) for (let i = 0; i < rowsN - 1; i++) out.push(...pt(i, j), ...pt(i + 1, j));
  return lineGeo(out);
}
function lineGeo(pts: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function nearestRow(st: number[], sx: number) {
  let best = 0;
  st.forEach((v, i) => { if (Math.abs(v - sx) < Math.abs(st[best] - sx)) best = i; });
  return best;
}

/** Arch angles: the part of the circle above the sill line (SVG y 306). */
function archRange(cy: number, r: number) {
  const below = Math.asin(Math.min(1, (cy - SVG.toY(306)) / r));
  return [-below, Math.PI + below] as const;
}
function archLine(cx: number, cy: number, r: number, z: number) {
  const [t0, t1] = archRange(cy, r);
  const pts: number[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a), z, cx + r * Math.cos(b), cy + r * Math.sin(b), z);
  }
  return lineGeo(pts);
}
/** Inner fender: an open half tube around the wheel, from z0 (inboard) out to just inside the body surface. */
function archLiner(cx: number, cy: number, r: number, z0: number, sd: 1 | -1) {
  const [t0, t1] = archRange(cy, r);
  const n = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    const outer = sd * (surfaceZ(px, py) - 0.01);
    pos.push(px, py, z0, px, py, outer);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Body surface z at car-space (x, y) on the +z side: the section angle whose height is closest to y. */
function surfaceZ(cx: number, cy: number) {
  const sx = cx * 100 + 500;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= 90; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 90;
    const d = Math.abs(SVG.toY(bodySection(sx, a)[1]) - cy);
    if (d < bestD) { bestD = d; best = a; }
  }
  return bodySection(sx, best)[0] / 100;
}
/** A round lip along the arch edge, sitting on the body surface; hides the cut's stepped edge. */
function archLip(cx: number, cy: number, r: number, sd: 1 | -1) {
  const [t0, t1] = archRange(cy, r);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = t0 + ((t1 - t0) * i) / 48;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    pts.push(new THREE.Vector3(px, py, sd * (surfaceZ(px, py) + 0.004)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.038, 8, false);
}

function boxPart(sx0: number, sx1: number, y0: number, y1: number, z: number, zc = 0) {
  const g = new THREE.BoxGeometry((sx1 - sx0) / 100, y1 - y0, z * 2);
  g.translate(SVG.toX((sx0 + sx1) / 2), (y0 + y1) / 2, zc);
  return g;
}
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 16) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/* ---------- materials ---------- */

export type CarColors = { ink: THREE.Color; accent: THREE.Color; paper: THREE.Color; mid: THREE.Color; grid: THREE.Color };

const vert = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying float vX;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vX = wp.x;
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */ `
  uniform vec3 uColor; uniform float uBase; uniform float uRim; uniform float uPow; uniform float uOpacity; uniform float uReveal;
  varying vec3 vN; varying vec3 vV; varying float vX;
  void main() {
    if (vX > uReveal) discard;
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
    float edge = smoothstep(0.35, 0.0, uReveal - vX) * 0.5;
    gl_FragColor = vec4(uColor, (uBase + uRim * f + edge) * uOpacity);
  }`;
const lineVert = /* glsl */ `
  varying float vX;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vX = wp.x; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const lineFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uAlpha; uniform float uOpacity; uniform float uReveal;
  varying float vX;
  void main() {
    if (vX > uReveal) discard;
    float edge = smoothstep(0.5, 0.0, uReveal - vX);
    gl_FragColor = vec4(uColor, min(1.0, uAlpha + edge) * uOpacity);
  }`;

function shell(color: THREE.Color, base: number, rim: number, pow: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: color }, uBase: { value: base }, uRim: { value: rim }, uPow: { value: pow }, uOpacity: { value: 1 }, uReveal: { value: 99 } },
  });
}
function lines(color: THREE.Color, alpha: number) {
  return new THREE.ShaderMaterial({
    vertexShader: lineVert, fragmentShader: lineFrag, transparent: true, depthWrite: false,
    uniforms: { uColor: { value: color }, uAlpha: { value: alpha }, uOpacity: { value: 1 }, uReveal: { value: 99 } },
  });
}

type Pair = { xray: THREE.Material | null; solid: THREE.Material | null };

/* ---------- model ---------- */

export type CarModel = {
  root: THREE.Group;
  parts: { body: THREE.Group; glass: THREE.Group; frontWheel: THREE.Group; rearWheel: THREE.Group; internals: THREE.Group };
  /** Every selectable part, by id. */
  selectable: Map<PartId, THREE.Group>;
  /** X-ray shader materials (opacity, reveal and color uniforms). */
  materials: THREE.ShaderMaterial[];
  /** Solid-look materials that follow the theme accent (paint, caliper). */
  solid: { paint: THREE.MeshPhysicalMaterial; all: THREE.Material[] };
  /** Highlight materials for the selected and hovered part. */
  hi: { fill: THREE.ShaderMaterial; line: THREE.ShaderMaterial; hoverLine: THREE.ShaderMaterial; solid: THREE.MeshStandardMaterial };
  shadow: THREE.ShaderMaterial;
  colors: CarColors;
  state: { fill: number; dim: number; look: CarLook; selected: PartId | null; hovered: PartId | null };
  dispose(): void;
};

/** Higher wins when a click passes through several see-through parts (x-ray look only). */
const PRIORITY: Record<PartId, number> = { vin: 5, engine: 4, drivetrain: 4, interior: 4, fuel: 4, frontWheel: 3, rearWheel: 3, glass: 2, body: 1 };

/** The part a click means: the most specific hit in x-ray, the nearest visible hit in solid. */
export function pickPart(objects: THREE.Object3D[], look: CarLook = 'xray'): PartId | null {
  let best: PartId | null = null;
  for (const o of objects) {
    if (look === 'solid' && !o.visible) continue;
    let p: THREE.Object3D | null = o;
    while (p && !p.userData.part) p = p.parent;
    const id = p?.userData.part as PartId | undefined;
    if (!id) continue;
    if (look === 'solid') return id;
    if (!best || PRIORITY[id] > PRIORITY[best]) best = id;
  }
  return best;
}

export function buildCar(colors: CarColors): CarModel {
  const ink = colors.ink.clone();
  const acc = colors.accent.clone();

  // X-ray look.
  const x = {
    body: shell(ink, 0.012, 0.3, 2.6),
    glass: shell(acc, 0.04, 0.36, 1.8),
    tire: shell(ink, 0.05, 0.4, 1.8),
    rim: shell(ink, 0.04, 0.3, 1.4),
    trim: shell(ink, 0.03, 0.22, 2),
    accent: shell(acc, 0.12, 0.45, 1.6),
    vin: shell(acc, 0.9, 0.1, 1),
    line: lines(ink, 0.5),
    faint: lines(ink, 0.18),
    accentLine: lines(acc, 0.55),
  };

  // Solid look.
  const paint = new THREE.MeshPhysicalMaterial({ color: acc, metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
  const s = {
    paint,
    glass: new THREE.MeshPhysicalMaterial({ color: ink, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    tire: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.88, metalness: 0 }),
    rim: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.22 }),
    disc: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.4 }),
    caliper: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.35, metalness: 0.2 }),
    trim: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.15 }),
    head: new THREE.MeshPhysicalMaterial({ color: ink, metalness: 0.3, roughness: 0.08, clearcoat: 1, emissive: acc, emissiveIntensity: 0.35 }),
    tail: new THREE.MeshStandardMaterial({ color: ink, emissive: acc, emissiveIntensity: 0.7, roughness: 0.25 }),
    seam: new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 }),
  };

  const root = new THREE.Group();
  root.name = 'AIQ-01';
  const mesh = (geo: THREE.BufferGeometry, xray: THREE.Material | null, solid: THREE.Material | null) => {
    const m = new THREE.Mesh(geo, xray ?? solid ?? undefined);
    m.userData.mat = { xray, solid } satisfies Pair;
    return m;
  };
  const line = (geo: THREE.BufferGeometry, xray: THREE.Material | null, solid: THREE.Material | null = null) => {
    const l = new THREE.LineSegments(geo, xray ?? solid ?? undefined);
    l.userData.mat = { xray, solid } satisfies Pair;
    return l;
  };
  const edged = (g: THREE.Group, geo: THREE.BufferGeometry, xm: THREE.Material, sm: THREE.Material | null, xl: THREE.Material, angle = 30) =>
    g.add(mesh(geo, xm, sm), line(new THREE.EdgesGeometry(geo, angle), xl));

  /* Body, with the wheel arches cut out of the sides. */
  const archCut = (c: THREE.Vector3, n: THREE.Vector3) => {
    for (const w of [WHEELS.front, WHEELS.rear]) {
      if (Math.hypot(c.x - w.x, c.y - w.y) < ARCH_R && (Math.abs(n.z) > 0.55 || (n.y < -0.3 && Math.abs(c.z) > 0.7))) return false;
    }
    return true;
  };
  const bodySt = stations(XMIN + 0.01, XMAX - 0.01, 220);
  const COLS = 88;
  const body = loft(bodySt, COLS, true, bodySection, archCut);
  const bodyG = new THREE.Group();
  bodyG.name = 'body';
  bodyG.add(mesh(body.geometry, x.body, paint));
  const rows = [233, 398, 560, 743, 860].map((sx) => nearestRow(bodySt, sx));
  const q = COLS / 4;
  const cols = [Math.round(q), Math.round(q * 0.45), Math.round(q * 1.55), Math.round(q * 3), 0, Math.round(COLS / 2)];
  bodyG.add(line(loftLines(body.positions, bodySt.length, body.ring, [], cols, true), x.line));
  bodyG.add(line(loftLines(body.positions, bodySt.length, body.ring, rows, [], true), x.faint));
  for (const w of [WHEELS.front, WHEELS.rear]) {
    const W = halfWidth(w.x * 100 + 500) / 100;
    for (const sd of [1, -1]) {
      bodyG.add(line(archLine(w.x, w.y, ARCH_R, sd * (W - 0.02)), x.line));
      bodyG.add(mesh(archLiner(w.x, w.y, ARCH_R - 0.01, sd * W * 0.45, sd as 1 | -1), null, s.trim));
      bodyG.add(mesh(archLip(w.x, w.y, ARCH_R, sd as 1 | -1), null, s.trim));
      // Inner wall of the wheel well, so the open arch does not show through the car.
      const [t0, t1] = archRange(w.y, ARCH_R);
      const sh = new THREE.Shape();
      sh.moveTo(w.x + ARCH_R * Math.cos(t0), w.y + ARCH_R * Math.sin(t0));
      sh.absarc(w.x, w.y, ARCH_R, t0, t1, false);
      sh.closePath();
      const wall = new THREE.ShapeGeometry(sh, 24);
      wall.translate(0, 0, sd * W * 0.45);
      bodyG.add(mesh(wall, null, s.trim));
    }
  }

  /* Body detail. Angles: 0 is the +z side, pi/2 the top, pi the -z side. */
  const both = (lo: (t: number) => number, hi: (t: number) => number) => [[lo, hi], [mirrorA(hi), mirrorA(lo)]] as const;
  const detail = (geo: THREE.BufferGeometry, xm: THREE.Material, sm: THREE.Material, xl: THREE.Material = x.faint) => {
    bodyG.add(mesh(geo, xm, sm), line(new THREE.EdgesGeometry(geo, 25), xl, null));
  };
  detail(patch(55, 133, at(Math.PI + 0.32), at(2 * Math.PI - 0.32), 1.065, 12, 18), x.trim, s.trim, x.line);
  // Headlights: a swept blade along each front corner.
  for (const [lo, hi] of both((t) => 0.2 + 0.12 * t, (t) => 0.52 - 0.1 * t)) detail(patch(76, 170, lo, hi, 1.008), x.rim, s.head, x.line);
  // Lower intake across the nose, plus a slim upper grille slot.
  detail(patch(60, 86, at(Math.PI + 0.7), at(2 * Math.PI - 0.7), 1.008, 6, 20), x.trim, s.trim);
  detail(patch(58, 64, at(0.65), at(Math.PI - 0.65), 1.01, 3, 16), x.trim, s.trim);
  // Side intakes behind the front wheels.
  for (const [lo, hi] of both((t) => -0.34 + 0.12 * t, (t) => 0.06 - 0.04 * t)) detail(patch(322, 392, lo, hi, 1.006, 10, 6), x.trim, s.trim);
  // Taillight bar across the tail, and a black panel under it.
  detail(patch(930, 936, at(0.2), at(Math.PI - 0.2), 1.01, 3, 30), x.accent, s.tail, x.accentLine);
  detail(patch(926, 936, at(-0.3), at(-Math.PI + 0.3 + 2 * Math.PI), 1.008, 3, 20), x.trim, s.trim);
  // Door handles.
  for (const [lo, hi] of both(at(0.5), at(0.57))) detail(patch(598, 628, lo, hi, 1.01, 3, 2), x.rim, s.chrome);
  // Mirrors on stalks at the base of the A pillar.
  for (const sd of [1, -1]) {
    const base = surf(445, sd > 0 ? 0.52 : Math.PI - 0.52, 1);
    const head = new THREE.SphereGeometry(1, 20, 12);
    head.scale(0.15, 0.08, 0.12);
    head.translate(base.x + 0.08, base.y + 0.07, base.z + sd * 0.2);
    bodyG.add(mesh(head, x.rim, paint), line(new THREE.EdgesGeometry(head, 40), x.faint));
    bodyG.add(mesh(tube(base, new THREE.Vector3(base.x + 0.06, base.y + 0.06, base.z + sd * 0.13), 0.02, 8), x.trim, s.trim));
  }
  // Rear diffuser: a plate and five fins under the tail.
  bodyG.add(mesh(boxPart(868, 929, 0.2, 0.28, 1.05), x.trim, s.trim));
  for (const z of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const fin = boxPart(881, 928, 0.16, 0.26, 0.012, z);
    bodyG.add(mesh(fin, x.trim, s.trim), line(new THREE.EdgesGeometry(fin), x.faint));
  }
  // Exhaust tips.
  for (const z of [-0.62, 0.62]) {
    const tip = tube(new THREE.Vector3(SVG.toX(922), 0.42, z), new THREE.Vector3(SVG.toX(942), 0.42, z), 0.07, 20);
    bodyG.add(mesh(tip, x.rim, s.chrome), line(new THREE.EdgesGeometry(tip, 40), x.faint));
  }
  // Panel seams: doors, hood, deck lid.
  const seams: number[] = [];
  for (const sd of [1, -1]) {
    const A = (a: number) => (sd > 0 ? a : Math.PI - a);
    seam(seams, 420, A(-0.64), 397, A(0.9));
    seam(seams, 613, A(-0.62), 651, A(0.93));
    seam(seams, 420, A(-0.64), 613, A(-0.62));
    seam(seams, 295, A(0.23), 832, A(0.5));
    seam(seams, 152, A(0.62), 392, A(0.66));
    seam(seams, 868, A(0.62), 922, A(0.5), 8);
  }
  seam(seams, 152, 0.62, 152, Math.PI - 0.62);
  seam(seams, 868, 0.62, 868, Math.PI - 0.62);
  bodyG.add(line(lineGeo(seams), x.faint, s.seam));

  // Ground shadow.
  const shadowG = new THREE.PlaneGeometry(14, 10);
  shadowG.rotateX(-Math.PI / 2);
  const shadow = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: ink }, uGrid: { value: colors.grid.clone() }, uOpacity: { value: 1 }, uReveal: { value: 99 } },
    vertexShader: `varying vec2 ground;
      void main() {
        ground = position.xz;
        vec3 p = position;
        p.y -= 0.16 * p.z + 0.22;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor, uGrid;
      uniform float uOpacity;
      varying vec2 ground;
      void main() {
        vec2 uv = ground * 2.;
        vec2 cell = abs(fract(uv - .5) - .5) / max(fwidth(uv), vec2(.001));
        float grid = (1. - min(min(cell.x, cell.y), 1.)) * (1. - smoothstep(.45, 1., length(ground / vec2(6., 5.))));
        float shade = (1. - smoothstep(.18, 1., length(ground / vec2(4.6, 1.9)))) * .17 * uOpacity;
        gl_FragColor = vec4(mix(uGrid, uColor, smoothstep(.0,.16,shade)), shade + .18 * grid);
      }`,
  });
  const shadowMesh = new THREE.Mesh(shadowG, shadow);
  shadowMesh.raycast = () => {};
  bodyG.add(shadowMesh);

  /* Glass house. */
  const glassSt = stations(BELT.x0 + 1, BELT.x1 - 1, 80);
  const GC = 32;
  const glass = loft(glassSt, GC, false, glassSection);
  const glassG = new THREE.Group();
  glassG.name = 'glass';
  glassG.add(mesh(glass.geometry, x.glass, s.glass));
  glassG.add(line(loftLines(glass.positions, glassSt.length, glass.ring, [nearestRow(glassSt, 522), nearestRow(glassSt, 660)], [Math.round(GC / 2), 4, GC - 4], false), x.accentLine));
  // Solid look: the glass house is painted and the windows are dark glass laid on it.
  const gpatch = (sx0: number, sx1: number, lo: (sx: number) => number, hi: (sx: number) => number, nx = 20, na = 12) => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const sx = sx0 + ((sx1 - sx0) * i) / nx;
      for (let j = 0; j <= na; j++) {
        const an = lo(sx) + ((hi(sx) - lo(sx)) * j) / na;
        const [z, sy] = glassSection(sx, an);
        pos.push(SVG.toX(sx), SVG.toY(sy) + 0.006 * Math.sin(an), (z / 100) * 1.008);
      }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < na; j++) {
      const a0 = i * (na + 1) + j;
      idx.push(a0, a0 + na + 1, a0 + 1, a0 + 1, a0 + na + 1, a0 + na + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // Side window outline from the drawing (top edge), as an angle on the glass section.
  const dloTop: Seg[] = [
    { a: [412, 158], c1: [450, 124], c2: [486, 100], b: [524, 90] },
    { a: [524, 90], c1: [560, 84], c2: [610, 84], b: [646, 92] },
    { a: [646, 92], c1: [680, 100], c2: [710, 118], b: [728, 134] },
  ];
  const dloPts = dloTop.flatMap((sg) => Array.from({ length: 30 }, (_, i) => bez(sg, i / 29)));
  const dloY = (sx: number) => {
    for (let i = 1; i < dloPts.length; i++) {
      const [x0, y0] = dloPts[i - 1];
      const [x1, y1] = dloPts[i];
      if (sx >= x0 && sx <= x1 && x1 > x0) return y0 + ((sx - x0) / (x1 - x0)) * (y1 - y0);
    }
    return belt(sx);
  };
  const angleAt = (sx: number, sy: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 60; i++) {
      const an = (Math.PI / 2) * (i / 60);
      const d = Math.abs(glassSection(sx, an)[1] - sy);
      if (d < bestD) { bestD = d; best = an; }
    }
    return best;
  };
  const winTop = (sx: number) => Math.max(0.08, angleAt(sx, dloY(sx) + 5));
  const windows = [
    gpatch(420, 641, () => 0.04, winTop, 30, 8),
    gpatch(420, 641, (sx) => Math.PI - winTop(sx), () => Math.PI - 0.05, 30, 8),
    gpatch(650, 725, () => 0.06, winTop, 12, 8),
    gpatch(650, 725, (sx) => Math.PI - winTop(sx), () => Math.PI - 0.06, 12, 8),
    gpatch(404, 512, () => 0.55, () => Math.PI - 0.55, 14, 16),
    gpatch(688, 852, () => 0.62, () => Math.PI - 0.62, 18, 14),
  ];
  glassG.children[0].userData.mat = { xray: x.glass, solid: paint } satisfies Pair;
  for (const w of windows) glassG.add(mesh(w, null, s.glass), line(new THREE.EdgesGeometry(w, 50), x.line));

  /* Wheels: one group per axle, like the drawing's front and rear wheel. */
  const wheel = (sd: 1 | -1) => {
    const g = new THREE.Group();
    const R = WHEELS.r;
    const W = 0.48;
    // Tire section with a rounded shoulder and three tread grooves, revolved around the axle.
    const prof: [number, number][] = [
      [R - 0.19, -W / 2 + 0.02], [R - 0.12, -W / 2 - 0.006], [R - 0.06, -W / 2], [R - 0.016, -W / 2 + 0.022], [R, -W / 2 + 0.055],
    ];
    for (const gz of [-0.12, 0, 0.12]) prof.push([R, gz - 0.022], [R - 0.016, gz - 0.012], [R - 0.016, gz + 0.012], [R, gz + 0.022]);
    prof.push([R, W / 2 - 0.055], [R - 0.016, W / 2 - 0.022], [R - 0.06, W / 2], [R - 0.12, W / 2 + 0.006], [R - 0.19, W / 2 - 0.02]);
    const tireG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72);
    tireG.rotateX(Math.PI / 2);
    g.add(mesh(tireG, x.tire, s.tire), line(new THREE.EdgesGeometry(tireG, 60), x.line));

    // Rim: barrel, lip, five twin spokes, lug nuts and a center cap.
    const face = new THREE.Group();
    face.position.z = sd * (W / 2 - 0.06);
    const barrel = new THREE.CylinderGeometry(R - 0.19, R - 0.19, W - 0.06, 48, 1, true);
    barrel.rotateX(Math.PI / 2);
    g.add(mesh(barrel, x.rim, s.rim));
    const lip = new THREE.TorusGeometry(R - 0.2, 0.02, 8, 64);
    face.add(mesh(lip, x.rim, s.rim), line(new THREE.EdgesGeometry(lip, 50), x.line));
    for (let k = 0; k < 5; k++) {
      for (const off of [-0.11, 0.11]) {
        const sp = new THREE.BoxGeometry(0.038, R - 0.27, 0.03);
        sp.translate(0, (R - 0.27) / 2 + 0.08, 0);
        sp.rotateZ((k / 5) * Math.PI * 2 + off);
        face.add(mesh(sp, x.rim, s.rim), line(new THREE.EdgesGeometry(sp), x.line));
      }
    }
    const hub = new THREE.CylinderGeometry(0.1, 0.11, 0.05, 24);
    hub.rotateX(Math.PI / 2);
    face.add(mesh(hub, x.rim, s.rim));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + Math.PI / 5;
      const nut = new THREE.CylinderGeometry(0.016, 0.016, 0.04, 6);
      nut.rotateX(Math.PI / 2);
      nut.translate(Math.cos(a) * 0.07, Math.sin(a) * 0.07, sd * 0.02);
      face.add(mesh(nut, x.rim, s.chrome));
    }
    const cap = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 20);
    cap.rotateX(Math.PI / 2);
    cap.translate(0, 0, sd * 0.02);
    face.add(mesh(cap, x.accent, paint));
    g.add(face);

    // Brake disc and caliper.
    const disc = new THREE.CylinderGeometry(0.36, 0.36, 0.03, 48);
    disc.rotateX(Math.PI / 2);
    disc.translate(0, 0, -sd * 0.05);
    g.add(mesh(disc, x.accent, s.disc), line(new THREE.EdgesGeometry(disc, 30), x.accentLine));
    const cal = new THREE.BoxGeometry(0.16, 0.22, 0.1);
    cal.translate(-0.3, 0.12, -sd * 0.03);
    g.add(mesh(cal, x.accent, s.caliper), line(new THREE.EdgesGeometry(cal), x.accentLine));
    return g;
  };
  const axle = (name: string, ax: number) => {
    const g = new THREE.Group();
    g.name = name;
    const z = (halfWidth(ax * 100 + 500) - 30) / 100;
    for (const sd of [1, -1] as const) {
      const w = wheel(sd);
      w.position.set(ax, WHEELS.r, sd * z);
      g.add(w);
    }
    const shaft = tube(new THREE.Vector3(ax, WHEELS.r, -z), new THREE.Vector3(ax, WHEELS.r, z), 0.055);
    g.add(mesh(shaft, x.trim, s.disc));
    return g;
  };
  const frontWheel = axle('frontWheel', WHEELS.front.x);
  const rearWheel = axle('rearWheel', WHEELS.rear.x);

  /* Internals: x-ray only (the solid body hides them). */
  const groups = new Map<PartId, THREE.Group>();
  const grp = (id: PartId) => { let g = groups.get(id); if (!g) { g = new THREE.Group(); g.name = id; groups.set(id, g); } return g; };
  const add = (id: PartId, geo: THREE.BufferGeometry, xm: THREE.Material = x.accent, angle = 30) => edged(grp(id), geo, xm, null, x.accentLine, angle);
  const v = (sx: number, y: number, z: number) => new THREE.Vector3(SVG.toX(sx), y, z);
  const fx = WHEELS.front.x;
  const rx = WHEELS.rear.x;
  const wy = WHEELS.front.y;
  add('engine', boxPart(270, 420, 0.55, 1.05, 0.42));
  add('engine', boxPart(275, 415, 1.05, 1.2, 0.13, 0.24));
  add('engine', boxPart(275, 415, 1.05, 1.2, 0.13, -0.24));
  add('engine', tube(v(285, 1.3, 0), v(405, 1.3, 0), 0.1));
  add('engine', boxPart(118, 132, 0.5, 1.05, 0.7));
  add('drivetrain', tube(new THREE.Vector3(fx, wy, -1.45), new THREE.Vector3(fx, wy, 1.45), 0.045));
  add('drivetrain', tube(new THREE.Vector3(rx, wy, -1.45), new THREE.Vector3(rx, wy, 1.45), 0.05));
  add('drivetrain', tube(v(420, 0.62, 0), v(700, 0.62, 0), 0.06));
  add('drivetrain', boxPart(700, 790, 0.45, 0.85, 0.3));
  for (const z of [-0.5, 0.5]) {
    add('interior', boxPart(560, 660, 0.42, 0.6, 0.22, z));
    const back = new THREE.BoxGeometry(0.16, 0.85, 0.44);
    back.rotateZ(0.32);
    back.translate(SVG.toX(668), 1.0, z);
    add('interior', back);
  }
  const sw = new THREE.TorusGeometry(0.19, 0.022, 8, 32);
  sw.rotateY(Math.PI / 2);
  sw.rotateZ(0.5);
  sw.translate(SVG.toX(505), 1.22, -0.5);
  add('interior', sw, x.accent, 50);
  add('interior', tube(v(505, 1.22, -0.5), v(440, 1.45, -0.5), 0.025));
  add('interior', tube(v(450, 1.4, -1.2), v(450, 1.4, 1.2), 0.035));
  add('fuel', boxPart(690, 800, 0.95, 1.2, 0.55));
  for (const z of [-0.62, 0.62]) add('fuel', tube(v(400, 0.38, z * 0.5), v(925, 0.42, z), 0.045));
  const plate = new THREE.BoxGeometry(0.22, 0.02, 0.1);
  plate.translate(SVG.toX(420), SVG.toY(160), -0.95);
  add('vin', plate, x.vin, 10);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.35).translate(SVG.toX(420), SVG.toY(160), -0.95));
  hit.visible = false;
  hit.userData.hitOnly = true;
  grp('vin').add(hit);
  const inside = new THREE.Group();
  inside.name = 'internals';
  for (const sub of groups.values()) inside.add(sub);

  root.add(bodyG, inside, frontWheel, rearWheel, glassG);
  // X-ray draw order: internals first, the shell over them, glass last.
  inside.traverse((o) => { o.renderOrder = 1; });
  bodyG.traverse((o) => { o.renderOrder = 2; });
  frontWheel.traverse((o) => { o.renderOrder = 3; });
  rearWheel.traverse((o) => { o.renderOrder = 3; });
  glassG.traverse((o) => { o.renderOrder = 4; });

  // Selection: tag part roots; keep lines out of ray hits.
  const selectable = new Map<PartId, THREE.Group>([['body', bodyG], ['glass', glassG], ['frontWheel', frontWheel], ['rearWheel', rearWheel], ...groups]);
  for (const [id, g] of selectable) g.userData.part = id;
  root.traverse((o) => { if ((o as THREE.LineSegments).isLineSegments) o.raycast = () => {}; });

  const hi = {
    fill: shell(acc, 0.16, 0.7, 1.3),
    line: lines(acc, 0.95),
    hoverLine: lines(acc, 0.8),
    solid: new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }),
  };
  Object.entries(s).forEach(([name, material]) => { material.name = name; });
  const solidAll = [...Object.values(s)];
  const materials = [...Object.values(x), shadow];
  const model: CarModel = {
    root,
    parts: { body: bodyG, glass: glassG, frontWheel, rearWheel, internals: inside },
    selectable,
    materials,
    solid: { paint, all: solidAll },
    hi,
    shadow,
    colors: { ...colors, ink, accent: acc },
    state: { fill: 1, dim: 1, look: 'xray', selected: null, hovered: null },
    dispose() {
      root.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
      [...materials, ...solidAll, ...Object.values(hi)].forEach((m) => m.dispose());
    },
  };
  setColors(model, colors);
  applyMaterials(model);
  return model;
}

/** Set the draw-in sweep (world x; everything right of it is hidden) on every x-ray material. */
export function setReveal(model: CarModel, x: number) {
  for (const m of [...model.materials, model.hi.fill, model.hi.line, model.hi.hoverLine]) if (m.uniforms.uReveal) m.uniforms.uReveal.value = x;
}

function applyOpacity(model: CarModel) {
  const { fill, dim, look } = model.state;
  for (const m of model.materials) if (m.uniforms.uOpacity) m.uniforms.uOpacity.value = (m.uniforms.uAlpha ? 1 : fill) * dim;
  model.shadow.uniforms.uOpacity.value = look === 'solid' ? 2.6 : fill * dim;
}

/** Put each object in the material for the current look, selection and hover. */
function applyMaterials(model: CarModel) {
  const { look, selected, hovered } = model.state;
  for (const [id, g] of model.selectable) {
    const mode = id === selected ? 'sel' : id === hovered ? 'hov' : null;
    g.traverse((o) => {
      const pair = o.userData.mat as Pair | undefined;
      if (!pair) return;
      const isLine = (o as THREE.LineSegments).isLineSegments;
      let m: THREE.Material | null = pair[look];
      if (mode === 'sel') m = isLine ? model.hi.line : look === 'solid' ? (m ? model.hi.solid : null) : model.hi.fill;
      else if (mode === 'hov' && isLine) m = model.hi.hoverLine;
      o.visible = !!m;
      if (m) (o as THREE.Mesh).material = m;
    });
  }
  model.state.dim = selected && look === 'xray' ? 0.45 : 1;
  applyOpacity(model);
}

/** Selected part in full accent, hovered part outlined; in x-ray the rest fades back while a part is selected. */
export function highlight(model: CarModel, selected: PartId | null, hovered: PartId | null) {
  model.state.selected = selected;
  model.state.hovered = hovered;
  applyMaterials(model);
}

export function setLook(model: CarModel, look: CarLook) {
  model.state.look = look;
  applyMaterials(model);
}

/** Recolor in place (theme change). Colors are shared objects, so one copy updates every material. */
export function setColors(model: CarModel, colors: CarColors) {
  model.colors.ink.copy(colors.ink);
  model.colors.accent.copy(colors.accent);
  const hsl = { h: 0, s: 0, l: 0 };
  model.solid.paint.color.copy(colors.ink).lerp(colors.mid, 0.22);
  const dark = colors.ink.getHSL(hsl).l < 0.5 ? colors.ink : colors.paper;
  for (const material of model.solid.all) {
    if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.LineBasicMaterial)) continue;
    switch (material.name) {
      case 'glass': material.color.copy(dark).multiplyScalar(0.25); break;
      case 'trim': case 'seam': case 'tire': material.color.copy(dark).multiplyScalar(0.42); break;
      case 'rim': case 'chrome': case 'head': material.color.copy(colors.mid).lerp(colors.paper, 0.4); break;
      case 'disc': material.color.copy(colors.mid); break;
      case 'caliper': case 'tail': material.color.copy(colors.accent); break;
    }
    if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0) {
      if (material.name === 'head' || material.name === 'tail') material.emissive.copy(material.color);
    }
  }
  model.shadow.uniforms.uGrid.value.copy(colors.grid);
  model.hi.solid.color.copy(colors.accent);
  model.hi.solid.emissive.copy(colors.accent);
  // Dark ink on a light page stacks up fast across front and back faces: thin the fills there.
  colors.ink.getHSL(hsl);
  model.state.fill = hsl.l < 0.5 ? 0.6 : 1;
  applyOpacity(model);
}

/** Triangle count, for the README and a sanity check. */
export function triangles(root: THREE.Object3D) {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return n;
}
