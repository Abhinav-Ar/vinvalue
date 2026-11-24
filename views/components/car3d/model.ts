/**
 * Car Concept, Eric Chadwick / © 2024 Darmstadt Graphics Group GmbH, CC BY 4.0.
 * https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept#legal
 * https://creativecommons.org/licenses/by/4.0/ · Based on Unity Fan's public-domain design.
 * AutoIQ adaptation removes marks, batches by assembly, compresses and restyles the finishes.
 */
import * as THREE from 'three';
import type { PartId } from './parts';

export type { PartId } from './parts';
export type CarLook = 'xray' | 'solid';
export type CarColors = Record<'ink' | 'accent' | 'paper' | 'mid' | 'grid', THREE.Color>;
type Phase = 'lift' | 'out' | 'down';
type Motion = {
  group: THREE.Object3D;
  home: THREE.Vector3;
  offset: THREE.Vector3;
  swing: number;
  phase: Phase;
  guide?: THREE.Line;
};
type Surface = {
  mesh: THREE.Mesh;
  solid: THREE.MeshStandardMaterial;
  xray: THREE.Material;
  part: PartId;
  edges?: THREE.LineSegments;
};
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function shell() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      ink: { value: new THREE.Color() },
      light: { value: new THREE.Color() },
      density: { value: 0.24 },
    },
    vertexShader: `
      varying vec3 n;
      void main() {
        n = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform vec3 ink, light;
      uniform float density;
      varying vec3 n;
      void main() {
        vec3 normal = normalize(n);
        float rim = pow(1. - abs(normal.z), 2.);
        float key = smoothstep(-.72, .9, dot(normal, normalize(vec3(-.45,.85,.38))));
        gl_FragColor = vec4(mix(ink, light, .78 * key), density + .46 * rim);
        #include <colorspace_fragment>
      }`,
  });
}

// Let clearcoat reflections describe the silhouette while the side facing the reader opens onto the cabin.
function phantomPaint(original: THREE.MeshStandardMaterial) {
  const finish = original.clone();
  finish.transparent = true;
  finish.depthWrite = false;
  finish.side = THREE.FrontSide;
  finish.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float grazing = pow(1.0 - abs(normal.z), 2.0);
      float shoulder = smoothstep(.32, .82, normal.y);
      diffuseColor.a = .12 + .46 * grazing + .24 * shoulder;
      #include <opaque_fragment>
    `,
    );
  };
  return finish;
}

function ground() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color() }, grid: { value: new THREE.Color() } },
    vertexShader: `varying vec2 p; void main() { p=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 p; uniform vec3 color,grid;
      void main() {
        vec2 uv=p*2.;
        vec2 cell=abs(fract(uv-.5)-.5)/max(fwidth(uv),vec2(.001));
        float line=(1.-min(min(cell.x,cell.y),1.))*(1.-smoothstep(.42,1.,length(p/vec2(5.8,3.7))));
        float ao=.23*exp(-pow(p.x/3.55,4.)-pow(p.y/1.52,4.));
        gl_FragColor=vec4(mix(grid,color,smoothstep(.0,.15,ao)),ao+.13*line);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(13, 9).rotateX(-Math.PI / 2), material);
  mesh.position.y = -0.04;
  mesh.renderOrder = -1;
  mesh.raycast = () => {};
  return mesh;
}

export function buildCar(source: THREE.Group, colors: CarColors) {
  const root = source.clone(true);
  const shadow = ground();
  const paintShell = shell(),
    glazing = shell();
  paintShell.uniforms.density.value = 0.17;
  glazing.uniforms.density.value = 0.075;
  const outlines = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.33, depthWrite: false });
  const guides = new THREE.LineDashedMaterial({
    transparent: true,
    opacity: 0.48,
    dashSize: 0.075,
    gapSize: 0.055,
    depthWrite: false,
  });
  const selectedLine = new THREE.LineBasicMaterial();
  const selected = new THREE.MeshStandardMaterial({ metalness: 0.45, roughness: 0.33 });
  const finishes = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const cutawayFinishes = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const surfaces: Surface[] = [];
  const motions: Motion[] = [];
  const owned = new Set<THREE.Material>([
    shadow.material,
    paintShell,
    glazing,
    outlines,
    guides,
    selectedLine,
    selected,
  ]);
  const geometries = new Set<THREE.BufferGeometry>([shadow.geometry]);
  const node = (name: string) => root.getObjectByName(name)!;

  function assembly(
    name: string,
    part: PartId,
    phase: Phase,
    offset: THREE.Vector3,
    swing = 0,
    anchor?: THREE.Vector3,
  ) {
    const group = node(name);
    const motion: Motion = { group, home: group.position.clone(), offset, phase, swing };
    motions.push(motion);
    if (anchor) {
      const geometry = new THREE.BufferGeometry().setFromPoints([v(), v(0, 1)]);
      geometries.add(geometry);
      const guide = new THREE.Line(geometry, guides);
      guide.computeLineDistances();
      guide.position.copy(anchor);
      guide.visible = false;
      guide.raycast = () => {};
      root.add(guide);
      motion.guide = guide;
    }
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material as THREE.MeshStandardMaterial;
      let solid = finishes.get(original);
      if (!solid) {
        solid = original.clone();
        finishes.set(original, solid);
        owned.add(solid);
      }
      const glass = original.name === 'Glass';
      const exterior = part === 'body' || part === 'glass';
      let xray: THREE.Material = glass ? glazing : paintShell;
      const painted = original.name.startsWith('Paint ');
      if (painted) {
        let finish = cutawayFinishes.get(original);
        if (!finish) {
          finish = phantomPaint(solid);
          cutawayFinishes.set(original, finish);
          owned.add(finish);
        }
        xray = finish;
      } else if (/Headlight|Brakelight|Signallight|Mirror/.test(original.name)) {
        xray = solid;
      } else if (!exterior && part !== 'chassis') {
        // Preserve AO, tread, perforations and the baked mechanical normal map in the lighter cutaway finishes.
        let finish = cutawayFinishes.get(original);
        if (!finish) {
          finish = solid.clone();
          cutawayFinishes.set(original, finish);
          owned.add(finish);
          if (original.name === 'Mechanical') {
            finish.color.setHex(0xb0b8c1);
            finish.metalness = 0.58;
            finish.roughness = 0.49;
          } else if (part === 'interior') {
            finish.color.setHex(original.name.includes('Interior 3') ? 0x82909f : 0x4e5864);
            finish.roughness = 0.66;
          }
        }
        xray = finish;
      }
      const surface: Surface = { mesh: object, part: glass ? 'glass' : part, solid, xray };
      object.userData.part = surface.part;
      surfaces.push(surface);
      if (painted || glass || /Rim2|Brake$/.test(original.name)) {
        const geometry = new THREE.EdgesGeometry(object.geometry, 32);
        geometries.add(geometry);
        const edges = new THREE.LineSegments(geometry, outlines);
        edges.renderOrder = 5;
        edges.raycast = () => {};
        object.add(edges);
        surface.edges = edges;
      }
    });
  }

  assembly('Shell', 'body', 'lift', v(0, 0.52));
  assembly('Canopy', 'glass', 'lift', v(0, 1.04), 0, v(-0.25, 2.05, -0.93));
  assembly('BodyHood', 'body', 'lift', v(-0.08, 0.82), 0, v(-3.35, 0.89, -0.45));
  assembly('BodyRearPanelsColor1', 'body', 'lift', v(0.1, 0.78), 0, v(3.04, 1.2, -0.52));
  assembly('Cabin', 'interior', 'lift', v(0, 0.18));
  assembly('Engine', 'engine', 'down', v(-0.14, -0.28));
  assembly('Axles', 'drivetrain', 'down', v(0, -0.27));
  assembly('Undertray', 'chassis', 'down', v(0, -0.33));
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    assembly('BodyDoor' + side + 'Color1', 'body', 'out', v(0, 0.48, sign * 0.1), -sign * 0.81);
    for (const axle of ['Front', 'Rear'] as const) {
      const name = 'Wheel' + axle + side;
      assembly(
        name,
        axle === 'Front' ? 'frontWheel' : 'rearWheel',
        'out',
        v(0, 0, sign * 1.15),
        0,
        node(name).position,
      );
    }
  }
  root.add(shadow);
  const model = {
    root,
    motions,
    shadow,
    paintShell,
    glazing,
    guides,
    outlines,
    selectedLine,
    selected,
    surfaces,
    looks: { look: 'xray' as CarLook, selected: null as PartId | null, hovered: null as PartId | null },
    canopy: node('Canopy'),
    wheels: [node('WheelFrontL'), node('WheelFrontR'), node('WheelRearL'), node('WheelRearR')],
    dispose() {
      owned.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    },
  };
  setColors(model, colors);
  setLook(model, 'xray');
  return model;
}

export type CarModel = ReturnType<typeof buildCar>;

export function setColors(model: CarModel, c: CarColors) {
  const night = c.paper.r < 0.2;
  for (const shell of [model.paintShell, model.glazing]) {
    shell.uniforms.ink.value.copy(night ? c.accent : c.ink);
    shell.uniforms.light.value.copy(night ? c.ink : c.accent);
  }
  model.shadow.material.uniforms.color.value.setHex(0x09192c);
  model.shadow.material.uniforms.grid.value.copy(c.grid);
  model.outlines.color.copy(c.accent).lerp(c.ink, 0.42);
  model.guides.color.copy(c.accent);
  model.selected.color.copy(c.accent);
  model.selectedLine.color.copy(c.accent);
  for (const { solid, xray } of model.surfaces) {
    if (solid.name.startsWith('Paint 1') && solid instanceof THREE.MeshPhysicalMaterial) {
      solid.color.copy(night ? c.paper : c.accent);
      solid.metalness = 0.62;
      solid.roughness = 0.28;
      solid.clearcoat = 1;
      solid.clearcoatRoughness = 0.1;
      solid.normalScale.setScalar(0.06);
    }
    if (solid.name.startsWith('Paint ') && xray instanceof THREE.MeshStandardMaterial) {
      xray.color.copy(c.accent).lerp(night ? c.paper : c.mid, night ? 0.65 : 0.32);
      xray.metalness = 0.45;
      xray.roughness = 0.28;
      xray.normalScale.setScalar(0.05);
    }
    if (solid.name === 'Mechanical') {
      solid.color.setHex(0x79828b);
      solid.metalness = 0.65;
      solid.roughness = 0.48;
    }
    if (solid.name === 'Brake') solid.color.copy(c.accent);
  }
}

export function setLook(model: CarModel, look: CarLook) {
  model.looks.look = look;
  for (const { mesh, part, solid, xray, edges } of model.surfaces) {
    const active = model.looks.selected === part;
    mesh.material = active ? model.selected : look === 'solid' ? solid : xray;
    mesh.renderOrder = mesh.material.transparent
      ? mesh.material === model.glazing || solid.name === 'Glass'
        ? 3
        : 2
      : 0;
    if (edges) {
      const focus = active || model.looks.hovered === part;
      edges.visible = look === 'xray' || focus;
      edges.material = focus ? model.selectedLine : model.outlines;
    }
  }
}
export function highlight(model: CarModel, selected: PartId | null, hovered: PartId | null) {
  Object.assign(model.looks, { selected, hovered });
  setLook(model, model.looks.look);
}
export function pickPart(objects: THREE.Object3D[], look: CarLook): PartId | null {
  const hits = objects.map((o) => o.userData.part as PartId | undefined).filter((id) => id !== undefined);
  if (look === 'xray') return hits.find((id) => id !== 'glass' && id !== 'body') ?? hits[0] ?? null;
  return hits[0] ?? null;
}
