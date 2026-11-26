/**
 * Car Concept, Eric Chadwick / © 2024 Darmstadt Graphics Group GmbH, CC BY 4.0.
 * https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept#legal
 * https://creativecommons.org/licenses/by/4.0/ · Based on Unity Fan's public-domain design.
 * AutoIQ adaptation removes marks, batches by assembly, compresses and restyles the finishes.
 */
import * as THREE from 'three';
/** Assemblies of the model, used to pick a finish per part. */
export type PartId = 'body' | 'chassis' | 'glass' | 'frontWheel' | 'rearWheel' | 'engine' | 'drivetrain' | 'interior';
export type CarLook = 'xray' | 'solid';
export type CarColors = Record<'ink' | 'accent' | 'paper', THREE.Color>;
type Phase = 'lift' | 'out' | 'down';
type Motion = {
  group: THREE.Object3D;
  home: THREE.Vector3;
  offset: THREE.Vector3;
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

// Draw the opaque section first. The shell then deposits only its grazing rim
// and depth, hiding far-side panel lines without veiling the cabin beneath.
export const SHELL_LAYER = 1;

function shell() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    uniforms: { ink: { value: new THREE.Color() }, mask: { value: null }, texel: { value: new THREE.Vector2() } },
    vertexShader: `
      varying vec3 n;
      void main() {
        n = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform vec3 ink;
      uniform sampler2D mask;
      uniform vec2 texel;
      varying vec3 n;
      void main() {
        float facing = abs(normalize(n).z);
        float rim = 1. - smoothstep(0., clamp(1.6*fwidth(facing), .08, .46), facing);
        vec2 uv = gl_FragCoord.xy * texel;
        vec4 center = texture2D(mask, uv);
        vec4 dx = texture2D(mask, uv + vec2(texel.x, 0.)) - texture2D(mask, uv - vec2(texel.x, 0.));
        vec4 dy = texture2D(mask, uv + vec2(0., texel.y)) - texture2D(mask, uv - vec2(0., texel.y));
        float border = max(abs(dx.a), abs(dy.a));
        float crease = smoothstep(.43,.84,max(length(dx.rgb), length(dy.rgb)));
        gl_FragColor = vec4(ink, max(.46*rim, max(border*.96, crease*.57)*center.a));
        #include <colorspace_fragment>
      }`,
  });
}

// Retain the authored relief on the brake discs, tread and engine casting.
// Quantise the light after applying that relief, independent of studio lighting.
function section(original: THREE.MeshStandardMaterial, paper: THREE.Color, ink: THREE.Color) {
  const material = new THREE.MeshNormalMaterial({ normalMap: original.normalMap,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const tone = /^Tire/.test(original.name) ? .36 : /Mechanical|Rim1|Hardware/.test(original.name) ? .19 : .055;
  material.onBeforeCompile = shader => {
    shader.uniforms.paper = { value: paper };
    shader.uniforms.ink = { value: ink };
    shader.fragmentShader = 'uniform vec3 paper, ink;\n' + shader.fragmentShader.replace(
      'gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );',
      `float light = dot(normalize(normal), normalize(vec3(-.4,.8,.45)));
       float aa = clamp(fwidth(light), .015, .12);
       float shade = .19*(1.-smoothstep(-.25-aa,-.25+aa,light))
                   + .16*(1.-smoothstep(.42-aa,.42+aa,light));
       float contour = 1. - smoothstep(.025,.135,abs(normalize(vNormal).z));
       vec3 tint = mix(sRGBTransferOETF(vec4(paper,1.)).rgb, sRGBTransferOETF(vec4(ink,1.)).rgb, max(${tone} + shade, .65*contour));
       gl_FragColor = sRGBTransferEOTF(vec4(tint, 1.));
       #include <colorspace_fragment>`
    );
  };
  material.customProgramCacheKey = () => String(tone);
  return material;
}

function ground() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color() } },
    vertexShader: `varying vec2 p; void main() { p=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 p; uniform vec3 color;
      void main() {
        float bed = .18 * exp(-pow(abs((p.x+.15)/3.4),4.)-pow(abs(p.y/1.36),4.));
        vec2 tyre = vec2(min(abs(p.x+2.57), abs(p.x-2.27)), abs(p.y)-1.69)/vec2(.52,.27);
        gl_FragColor = vec4(color, bed + .29*exp(-dot(tyre,tyre)));
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
  const paintShell = shell();
  const paper = new THREE.Color(), ink = new THREE.Color();
  const outlines = new THREE.LineBasicMaterial({ transparent: true, opacity: .88, depthWrite: false, toneMapped: false });
  const detailLines = outlines.clone();
  detailLines.opacity = .54;
  const guides = new THREE.LineDashedMaterial({
    transparent: true,
    opacity: 0.48,
    dashSize: 0.075,
    gapSize: 0.055,
    depthWrite: false,
  });
  const selectedLine = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const selected = new THREE.MeshStandardMaterial({ metalness: 0.45, roughness: 0.33 });
  const finishes = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const cutawayFinishes = new Map<THREE.Material, THREE.MeshNormalMaterial>();
  const surfaces: Surface[] = [];
  const motions: Motion[] = [];
  const owned = new Set<THREE.Material>([
    shadow.material,
    paintShell,
    detailLines,
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
    anchor?: THREE.Vector3,
  ) {
    const group = node(name);
    const motion: Motion = { group, home: group.position.clone(), offset, phase };
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
      const painted = original.name.startsWith('Paint ');
      let xray: THREE.Material = paintShell;
      if (!exterior) {
        let finish = cutawayFinishes.get(original);
        if (!finish) {
          finish = section(original, paper, ink);
          cutawayFinishes.set(original, finish);
          owned.add(finish);
        }
        xray = finish;
      }
      const surface: Surface = { mesh: object, part: glass ? 'glass' : part, solid, xray };
      object.userData.part = surface.part;
      surfaces.push(surface);
      if (painted || glass) object.layers.enable(SHELL_LAYER);
      if (painted || glass || !exterior || /light|Mirror/.test(original.name)) {
        const geometry = new THREE.EdgesGeometry(object.geometry, exterior ? 38 : 58);
        geometries.add(geometry);
        const edges = new THREE.LineSegments(geometry, outlines);
        edges.renderOrder = exterior ? 5 : 1;
        edges.raycast = () => {};
        object.add(edges);
        surface.edges = edges;
      }
    });
  }

  const lift = v(0, 1.80);
  assembly('Shell', 'body', 'lift', lift, v(2.1, .57, 1.5));
  assembly('Canopy', 'glass', 'lift', lift);
  assembly('BodyHood', 'body', 'lift', lift, v(-3.35, .89, -.45));
  assembly('BodyRearPanelsColor1', 'body', 'lift', lift);
  assembly('Cabin', 'interior', 'lift', v());
  assembly('Engine', 'engine', 'down', v(0, -.56), node('Engine').position);
  assembly('Axles', 'drivetrain', 'down', v(0, -.56));
  assembly('Undertray', 'chassis', 'down', v(0, -.56));
  for (const [side, sign] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    assembly('BodyDoor' + side + 'Color1', 'body', 'out', v(0, 0, sign * 1.64), v(-.45, 1.2, sign * 1.8));
    for (const axle of ['Front', 'Rear'] as const) {
      const name = 'Wheel' + axle + side;
      assembly(
        name,
        axle === 'Front' ? 'frontWheel' : 'rearWheel',
        'out',
        v(0, 0, sign * 1.58),
        node(name).position,
      );
    }
  }
  root.updateMatrixWorld(true);
  function surfacePoint(group: THREE.Object3D, material: string, target: THREE.Vector3) {
    const point = v(), best = v();
    let distance = Infinity;
    group.traverse(child => {
      if (!(child instanceof THREE.Mesh) || child.material.name !== material) return;
      const positions = child.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
        const d = point.distanceToSquared(target);
        if (d < distance) { best.copy(point); distance = d; }
      }
    });
    return group.worldToLocal(best);
  }
  const wheels = ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'].map(node);
  const wheelPins = wheels.map(wheel => surfacePoint(wheel, 'Rim1',
    wheel.position.clone().add(v(0, 0, Math.sign(wheel.position.z)*.22))));
  const wheelHomes = wheels.map(wheel => wheel.position.clone());
  const canopy = node('Canopy');
  const glassPins = [1,-1].map(sign => surfacePoint(canopy, 'Glass', v(-1.35, 1.94, sign*.86)));
  root.add(shadow);
  const model = {
    root,
    motions,
    shadow,
    paintShell,
    detailLines,
    paper, ink,
    guides,
    outlines,
    selectedLine,
    selected,
    surfaces,
    looks: { look: 'xray' as CarLook, selected: null as PartId | null, hovered: null as PartId | null },
    canopy, wheels, wheelHomes, wheelPins, glassPins,
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
  model.paper.copy(c.paper);
  model.ink.copy(night ? c.ink : c.accent);
  model.paintShell.uniforms.ink.value.copy(model.ink);
  model.detailLines.color.copy(model.ink);
  model.shadow.material.uniforms.color.value.setHex(0x09192c);

  model.outlines.color.copy(model.ink);
  model.guides.color.copy(c.accent);
  model.selected.color.copy(c.accent);
  model.selectedLine.color.copy(night ? c.accent : c.ink);
  for (const { solid } of model.surfaces) {
    if (solid.name.startsWith('Paint 1') && solid instanceof THREE.MeshPhysicalMaterial) {
      solid.color.copy(night ? c.paper : c.accent);
      solid.metalness = 0.72;
      solid.roughness = 0.23;
      solid.clearcoat = 1;
      solid.clearcoatRoughness = 0.1;
      solid.normalScale.setScalar(0.06);
    }
    if (solid.name === 'Glass') {
      solid.color.setHex(night ? 0x32475c : 0x586a7a);
      solid.opacity = .54;
      solid.roughness = .13;
      solid.depthWrite = false;
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
  model.shadow.visible = look === 'solid';
  for (const { mesh, part, solid, xray, edges } of model.surfaces) {
    const active = model.looks.selected === part;
    mesh.material = look === 'solid' ? (active ? model.selected : solid) : xray;
    mesh.renderOrder = mesh.material.transparent
      ? solid.name === 'Glass'
        ? 3
        : 2
      : 0;
    if (edges) {
      const focus = active || model.looks.hovered === part;
      edges.visible = look === 'xray' || focus;
      edges.material = focus ? model.selectedLine : xray === model.paintShell ? model.outlines : model.detailLines;
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
