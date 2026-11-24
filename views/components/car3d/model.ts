/** Procedural longitudinal-engine GT. X runs from nose to tail, Y is up, Z follows the axles. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coachwork, stamping, type Draw } from './surfaces';
import { mechanicals } from './mechanicals';
import type { PartId } from './parts';

export type { PartId } from './parts';
export type CarLook = 'xray' | 'solid';

export const SVG = { toX: (sx: number) => (sx - 500) / 100, toY: (sy: number) => (330 - sy) / 100 };
export const WHEELS = {
  front: { x: SVG.toX(233), y: SVG.toY(261) },
  rear: { x: SVG.toX(743), y: SVG.toY(261) },
  r: 0.69,
};
/* ---------- materials ---------- */

export type CarColors = {
  ink: THREE.Color;
  accent: THREE.Color;
  paper: THREE.Color;
  mid: THREE.Color;
  grid: THREE.Color;
};

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
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color },
      uBase: { value: base },
      uRim: { value: rim },
      uPow: { value: pow },
      uOpacity: { value: 1 },
      uReveal: { value: 99 },
    },
  });
}
function lines(color: THREE.Color, alpha: number) {
  return new THREE.ShaderMaterial({
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: color }, uAlpha: { value: alpha }, uOpacity: { value: 1 }, uReveal: { value: 99 } },
  });
}

type Pair = { xray: THREE.Material | null; solid: THREE.Material | null };

/* ---------- model ---------- */

export type CarModel = {
  root: THREE.Group;
  motions: {
    group: THREE.Group;
    home: THREE.Vector3;
    offset: THREE.Vector3;
    phase: 'lift' | 'out' | 'down';
    guide: THREE.Line;
  }[];
  parts: {
    body: THREE.Group;
    glass: THREE.Group;
    frontWheel: THREE.Group;
    rearWheel: THREE.Group;
    internals: THREE.Group;
  };
  /** Every selectable part, by id. */
  selectable: Map<PartId, THREE.Group>;
  /** X-ray shader materials (opacity, reveal and color uniforms). */
  materials: THREE.ShaderMaterial[];
  /** Solid-look materials that follow the theme accent (paint, caliper). */
  solid: { paint: THREE.MeshPhysicalMaterial; all: THREE.Material[] };
  /** Highlight materials for the selected and hovered part. */
  hi: {
    fill: THREE.ShaderMaterial;
    line: THREE.ShaderMaterial;
    hoverLine: THREE.ShaderMaterial;
    solid: THREE.MeshStandardMaterial;
  };
  shadow: THREE.ShaderMaterial;
  colors: CarColors;
  state: { fill: number; dim: number; look: CarLook; selected: PartId | null; hovered: PartId | null };
  dispose(): void;
};

/** Higher wins when a click passes through several see-through parts (x-ray look only). */
const PRIORITY: Record<PartId, number> = {
  chassis: 2,
  vin: 5,
  engine: 4,
  drivetrain: 4,
  interior: 4,
  fuel: 4,
  frontWheel: 3,
  rearWheel: 3,
  glass: 2,
  body: 1,
};

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
  const machined = (density: number, color: THREE.Color) =>
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uPaper: { value: colors.paper.clone() }, uDensity: { value: density } },
      vertexShader: vert,
      side: THREE.DoubleSide,
      fragmentShader: `uniform vec3 uColor,uPaper; uniform float uDensity; varying vec3 vN; void main(){
        float light = dot(normalize(vN),normalize(vec3(-.4,.75,.6)));
        float tone=clamp(uDensity-light*.23,0.,1.);
        gl_FragColor=vec4(mix(uPaper,uColor,mix(tone*tone,sqrt(tone),step(.5,uPaper.r))),1.);
        #include <colorspace_fragment>
      }`,
    });
  const x = {
    machined: machined(0.61, ink),
    rubber: machined(0.73, acc),
    hardware: machined(0.44, ink),
    body: shell(ink, 0.012, 0.3, 2.6),
    glass: shell(acc, 0.04, 0.36, 1.8),
    tire: shell(ink, 0.05, 0.4, 1.8),
    rim: shell(ink, 0.04, 0.3, 1.4),
    trim: shell(ink, 0.03, 0.22, 2),
    accent: shell(acc, 0.12, 0.45, 1.6),
    vin: shell(acc, 0.9, 0.1, 1),
    line: lines(acc, 0.64),
    faint: lines(ink, 0.18),
    accentLine: lines(acc, 0.55),
  };

  // Solid look.
  const paint = new THREE.MeshPhysicalMaterial({
    color: acc,
    metalness: 0.45,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
  });
  const s = {
    paint,
    glass: new THREE.MeshPhysicalMaterial({
      color: ink,
      metalness: 0,
      transparent: true,
      opacity: 0.83,
      roughness: 0.09,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.1,
      side: THREE.DoubleSide,
    }),
    tire: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.88, metalness: 0 }),
    rim: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.22 }),
    disc: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.4 }),
    caliper: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.35, metalness: 0.2 }),
    trim: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide }),
    chrome: new THREE.MeshStandardMaterial({ color: ink, metalness: 1, roughness: 0.15 }),
    head: new THREE.MeshPhysicalMaterial({
      color: ink,
      metalness: 0.3,
      roughness: 0.08,
      clearcoat: 1,
      emissive: acc,
      emissiveIntensity: 0.35,
    }),
    tail: new THREE.MeshStandardMaterial({ color: ink, emissive: acc, emissiveIntensity: 0.7, roughness: 0.25 }),
    seam: new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 }),
  };

  for (const mat of [s.head, s.tail, s.chrome]) mat.side = THREE.DoubleSide;
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
  const bodyG = new THREE.Group(),
    glassG = new THREE.Group();
  const doors = [new THREE.Group(), new THREE.Group()];
  const chassis = new THREE.Group();
  bodyG.add(...doors);
  const axles = [WHEELS.front.x, WHEELS.rear.x];
  const draw: Draw = (group, geometry, finish, edges = true) => {
    const exterior = group === bodyG || group === glassG || group.parent === bodyG;
    const material =
      finish === 'glass'
        ? x.glass
        : exterior
          ? finish === 'head' || finish === 'tail'
            ? x.accent
            : x.body
          : finish === 'trim'
            ? x.rubber
            : finish === 'chrome'
              ? x.hardware
              : x.machined;
    group.add(mesh(geometry, material, s[finish]));
    if (edges) group.add(line(new THREE.EdgesGeometry(geometry, 36), exterior ? x.line : x.faint));
  };
  const { hood, decklid } = coachwork(bodyG, glassG, doors, draw, axles);
  // Ground shadow.
  const shadowG = new THREE.PlaneGeometry(14, 10);
  shadowG.rotateX(-Math.PI / 2);
  const shadow = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: ink },
      uGrid: { value: colors.grid.clone() },
      uOpacity: { value: 1 },
      uReveal: { value: 99 },
    },
    vertexShader: `varying vec2 ground;
      void main() {
        ground = position.xz;
        vec3 p = position;
        p.y -= 0.006;
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
  root.add(shadowMesh);

  /* Wheels: one group per axle, like the drawing's front and rear wheel. */
  const wheel = (sd: 1 | -1) => {
    const g = new THREE.Group();
    const R = WHEELS.r;
    const W = 0.48;
    // Tire section with a rounded shoulder and three tread grooves, revolved around the axle.
    const prof: [number, number][] = [
      [R - 0.19, -W / 2 + 0.02],
      [R - 0.12, -W / 2 - 0.006],
      [R - 0.06, -W / 2],
      [R - 0.016, -W / 2 + 0.022],
      [R, -W / 2 + 0.055],
    ];
    for (const gz of [-0.12, 0, 0.12])
      prof.push([R, gz - 0.022], [R - 0.016, gz - 0.012], [R - 0.016, gz + 0.012], [R, gz + 0.022]);
    prof.push(
      [R, W / 2 - 0.055],
      [R - 0.016, W / 2 - 0.022],
      [R - 0.06, W / 2],
      [R - 0.12, W / 2 + 0.006],
      [R - 0.19, W / 2 - 0.02],
    );
    const tireG = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
    );
    tireG.rotateX(Math.PI / 2);
    g.add(mesh(tireG, x.rubber, s.tire), line(new THREE.EdgesGeometry(tireG, 60), x.line));

    // Rim: barrel, lip, five twin spokes, lug nuts and a center cap.
    const face = new THREE.Group();
    face.position.z = sd * (W / 2 - 0.06);
    const revolve = (profile: number[][], segments: number) =>
      new THREE.LatheGeometry(
        profile.map(([r, z]) => new THREE.Vector2(r, z)),
        segments,
      ).rotateX(Math.PI / 2);
    const barrel = revolve(
      [
        [0.48, -0.215],
        [0.5, -0.21],
        [0.495, -0.16],
        [0.45, -0.08],
        [0.45, 0.08],
        [0.495, 0.16],
        [0.5, 0.21],
        [0.48, 0.215],
      ],
      48,
    );
    g.add(mesh(barrel, x.rim, s.rim));
    const lip = new THREE.TorusGeometry(R - 0.2, 0.02, 8, 64);
    face.add(mesh(lip, x.rim, s.rim), line(new THREE.EdgesGeometry(lip, 50), x.line));
    for (let k = 0; k < 5; k++) {
      for (const off of [-0.11, 0.11]) {
        const sp = stamping(
          [
            [-0.042, 0],
            [0.032, 0],
            [0.069, 0.36],
            [0.038, 0.41],
            [0.009, 0.38],
          ],
          0.026,
          0.009,
        );
        sp.translate(0, 0.085, -0.012);
        sp.rotateZ((k / 5) * Math.PI * 2 + off);
        face.add(mesh(sp, x.hardware, s.rim), line(new THREE.EdgesGeometry(sp), x.line));
      }
    }
    const hub = revolve(
      [
        [0, -0.035],
        [0.085, -0.035],
        [0.115, -0.02],
        [0.113, 0.012],
        [0.092, 0.034],
        [0, 0.034],
      ],
      24,
    );
    face.add(mesh(hub, x.rim, s.rim));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + Math.PI / 5;
      const nut = revolve(
        [
          [0, -0.022],
          [0.019, -0.022],
          [0.021, -0.016],
          [0.021, 0.014],
          [0.016, 0.023],
          [0, 0.023],
        ],
        6,
      );
      nut.translate(Math.cos(a) * 0.07, Math.sin(a) * 0.07, sd * 0.02);
      face.add(mesh(nut, x.rim, s.chrome));
    }
    const cap = revolve(
      [
        [0, -0.03],
        [0.042, -0.03],
        [0.046, 0.012],
        [0.041, 0.029],
        [0.029, 0.034],
        [0, 0.034],
      ],
      20,
    );
    cap.translate(0, 0, sd * 0.02);
    face.add(mesh(cap, x.accent, paint));
    g.add(face);

    // Brake disc and caliper.
    const rotor = new THREE.Shape();
    for (let i = 0; i < 64; i++) {
      const angle = (i * Math.PI) / 32,
        px = 0.374 * Math.cos(angle),
        py = 0.374 * Math.sin(angle);
      if (i === 0) rotor.moveTo(px, py);
      else rotor.lineTo(px, py);
    }
    rotor.closePath();
    for (let i = 0; i < 30; i++) {
      const a = (i * Math.PI) / 15,
        r = i % 2 ? 0.332 : 0.297;
      const vent = new THREE.Path();
      vent.absarc(r * Math.cos(a), r * Math.sin(a), 0.016, 0, Math.PI * 2, true);
      rotor.holes.push(vent);
    }
    const disc = new THREE.ExtrudeGeometry(rotor, { depth: 0.035, bevelEnabled: false, curveSegments: 4 }).translate(
      0,
      0,
      -sd * 0.05,
    );
    g.add(mesh(disc, x.machined, s.disc));
    const cal = stamping(
      [
        [-0.35, 0.02],
        [-0.28, 0.04],
        [-0.18, 0.2],
        [-0.19, 0.29],
        [-0.26, 0.31],
        [-0.37, 0.14],
      ],
      0.115,
    );
    g.add(mesh(cal, x.accent, s.caliper));
    return g;
  };
  const axle = (name: string, ax: number) => {
    const g = new THREE.Group();
    g.name = name;
    const z = 1.44;
    for (const sd of [1, -1] as const) {
      const w = wheel(sd);
      w.position.set(ax, WHEELS.r, sd * z);
      g.add(w);
    }
    return g;
  };
  const frontWheel = axle('frontWheel', WHEELS.front.x);
  const rearWheel = axle('rearWheel', WHEELS.rear.x);

  /* Internals: x-ray only (the solid body hides them). */
  const groups = new Map<PartId, THREE.Group>();
  const grp = (id: PartId) => {
    let g = groups.get(id);
    if (!g) {
      g = new THREE.Group();
      g.name = id;
      groups.set(id, g);
    }
    return g;
  };
  mechanicals(grp, chassis, draw, axles);
  root.add(chassis);
  const inside = new THREE.Group();
  inside.name = 'internals';
  for (const sub of groups.values()) inside.add(sub);

  root.add(bodyG, inside, frontWheel, rearWheel, glassG);
  // Batch static geometry by finish within each independently moving assembly.
  const batch = (g: THREE.Group) => {
    const buckets = new Map<string, (THREE.Mesh | THREE.LineSegments)[]>();
    for (const obj of [...g.children]) {
      if (obj instanceof THREE.Group) {
        batch(obj);
        continue;
      }
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments)) continue;
      const pair = obj.userData.mat as Pair;
      const key = [obj.type, pair.xray?.uuid, pair.solid?.uuid].join('/');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(obj);
    }
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue;
      const geometries = objects.map((o) => {
        const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        geo.deleteAttribute('uv');
        return geo;
      });
      const combined = mergeGeometries(geometries)!;
      for (const g of geometries) g.dispose();
      for (const o of objects) {
        g.remove(o);
        o.geometry.dispose();
      }
      const first = objects[0],
        pair = first.userData.mat;
      g.add(
        first instanceof THREE.LineSegments
          ? line(combined, pair.xray, pair.solid)
          : mesh(combined, pair.xray, pair.solid),
      );
    }
  };
  for (const group of [bodyG, glassG, inside, chassis, frontWheel, rearWheel]) batch(group);
  // X-ray draw order: internals first, the shell over them, glass last.
  inside.traverse((o) => {
    o.renderOrder = 1;
  });
  bodyG.traverse((o) => {
    o.renderOrder = 2;
  });
  frontWheel.traverse((o) => {
    o.renderOrder = 3;
  });
  rearWheel.traverse((o) => {
    o.renderOrder = 3;
  });
  glassG.traverse((o) => {
    o.renderOrder = 4;
  });

  // Selection: tag part roots; keep lines out of ray hits.
  const selectable = new Map<PartId, THREE.Group>([
    ['chassis', chassis],
    ['body', bodyG],
    ['glass', glassG],
    ['frontWheel', frontWheel],
    ['rearWheel', rearWheel],
    ...groups,
  ]);
  for (const [id, g] of selectable) g.userData.part = id;
  root.traverse((o) => {
    if ((o as THREE.LineSegments).isLineSegments) o.raycast = () => {};
  });

  const hi = {
    fill: shell(acc, 0.16, 0.7, 1.3),
    line: lines(acc, 0.95),
    hoverLine: lines(acc, 0.8),
    solid: new THREE.MeshStandardMaterial({
      color: acc,
      emissive: acc,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
  };
  Object.entries(s).forEach(([name, material]) => {
    material.name = name;
  });
  const solidAll = [...Object.values(s)];
  const materials = [...Object.values(x), shadow];
  const motions: CarModel['motions'] = [];
  const guideMaterial = new THREE.LineDashedMaterial({
    color: acc,
    dashSize: 0.07,
    gapSize: 0.055,
    transparent: true,
    opacity: 0.48,
  });
  const motion = (group: THREE.Group, phase: 'lift' | 'out' | 'down', offset: THREE.Vector3, anchor: THREE.Vector3) => {
    const guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]),
      guideMaterial,
    );
    guide.position.copy(anchor);
    guide.computeLineDistances();
    guide.frustumCulled = false;
    guide.raycast = () => {};
    root.add(guide);
    motions.push({ group, home: group.position.clone(), offset, phase, guide });
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  motion(bodyG, 'lift', v(0, 0.7, 0), v(-2.1, 1.46, 0));
  motion(hood, 'lift', v(0, 0.42, 0), v(-2.5, 1.54, 0));
  motion(decklid, 'lift', v(0, 0.28, 0), v(3.55, 1.65, 0));
  motion(glassG, 'lift', v(0, 1.32, 0), v(0.6, 2.43, 0));
  for (const [i, g] of doors.entries())
    motion(g, 'out', v(0, 0, (i ? 1 : -1) * 1.13), v(0.35, 1.1, (i ? 1 : -1) * 1.57));
  for (const axle of [frontWheel, rearWheel])
    for (const w of axle.children) {
      if (w instanceof THREE.Group) motion(w, 'out', v(0, 0, Math.sign(w.position.z) * 1.48), w.position);
    }
  for (const [id, offset, anchor] of [
    ['engine', v(-0.74, -0.68, 0.48), v(-2, 1, 0)],
    ['drivetrain', v(0, -0.58, 0), v(2.43, 0.69, 0)],
    ['fuel', v(0.17, -0.84, 0), v(2, 0.95, 0)],
    ['interior', v(0, 0.34, 0), v(0.45, 0.6, 0)],
    ['vin', v(0, 0.34, 0), v(-1.03, 1.48, -0.93)],
  ] as const)
    motion(grp(id), id === 'vin' || id === 'interior' ? 'lift' : 'down', offset, anchor);
  const model: CarModel = {
    motions,
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
      guideMaterial.dispose();
      root.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
      [...materials, ...solidAll, ...Object.values(hi)].forEach((m) => m.dispose());
    },
  };
  setColors(model, colors);
  applyMaterials(model);
  return model;
}

/** Set the draw-in sweep (world x; everything right of it is hidden) on every x-ray material. */
export function setReveal(model: CarModel, x: number) {
  for (const m of [...model.materials, model.hi.fill, model.hi.line, model.hi.hoverLine])
    if (m.uniforms.uReveal) m.uniforms.uReveal.value = x;
}

function applyOpacity(model: CarModel) {
  const { fill, dim, look } = model.state;
  for (const m of model.materials)
    if (m.uniforms.uOpacity) m.uniforms.uOpacity.value = (m.uniforms.uAlpha ? 1 : fill) * dim;
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
  for (const m of model.materials) m.uniforms.uPaper?.value.copy(colors.paper);
  for (const motion of model.motions) (motion.guide.material as THREE.LineDashedMaterial).color.copy(colors.accent);
  model.colors.ink.copy(colors.ink);
  model.colors.accent.copy(colors.accent);
  const hsl = { h: 0, s: 0, l: 0 };
  model.solid.paint.color.copy(colors.accent).lerp(colors.paper, 0.17);
  const dark = colors.ink.getHSL(hsl).l < 0.5 ? colors.ink : colors.paper;
  for (const material of model.solid.all) {
    if (!(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.LineBasicMaterial)) continue;
    switch (material.name) {
      case 'glass':
        material.color.copy(dark).multiplyScalar(0.25);
        break;
      case 'tire':
        material.color.setHex(0x22252a);
        break;
      case 'trim':
      case 'seam':
        material.color.copy(dark).multiplyScalar(0.32);
        break;
      case 'head':
        material.color.setHex(0xf2f8ff);
        break;
      case 'rim':
      case 'chrome':
        material.color.setHex(0xb9c2ce);
        break;
      case 'disc':
        material.color.copy(colors.mid);
        break;
      case 'caliper':
      case 'tail':
        material.color.copy(colors.accent);
        break;
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
    if (m.isMesh && m.geometry)
      n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  });
  return n;
}
