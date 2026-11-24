// All panels use the same longitudinal stations and section boundaries.
import * as T from 'three';

export type Point = [number, number, number];
export type Finish = 'paint' | 'glass' | 'trim' | 'chrome' | 'head' | 'tail' | 'disc' | 'caliper';
export type Draw = (group: T.Group, geometry: T.BufferGeometry, finish: Finish, edges?: boolean) => void;
const mix = T.MathUtils.lerp;
export function skin(fn: (u: number, v: number) => Point, rows = 32, cols = 8) {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= cols; j++) {
      vertices.push(...fn(i / rows, j / cols));
      if (i < rows && j < cols) {
        const a = i * (cols + 1) + j,
          b = a + cols + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function pipe(points: Point[], radius: number, segments = points.length * 3, sides = 8) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  return new T.TubeGeometry(curve, segments, radius, sides, false);
}
export function stamping(profile: number[][], depth: number, bevel = 0.025) {
  const shape = new T.Shape(profile.map(([x, y]) => new T.Vector2(x, y)));
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
}
export function oval(x: number, y: number, z: number, l: number, h: number, w: number) {
  return new T.SphereGeometry(1, 20, 12).scale(l, h, w).translate(x, y, z);
}
const crown = (x: number) =>
  1.47 +
  0.16 * Math.exp(-((x + 2.6) ** 2) / 0.7) +
  0.21 * Math.exp(-((x - 2.5) ** 2) / 1.4) +
  0.09 * Math.tanh(x + 1) -
  0.44 * Math.exp(-((x + 4.45) ** 2) / 0.53);
const width = (x: number) =>
  1.54 +
  0.19 * Math.exp(-((x + 2.67) ** 2) / 0.9) +
  0.21 * Math.exp(-((x - 2.43) ** 2) / 1.25) -
  0.13 * Math.exp(-((x + 4.45) ** 2) / 0.5);
const endX = (x: number, z: number) =>
  x + 0.54 * (z / 1.7) ** 4 * (Math.exp(-((x + 4.45) ** 2) / 0.4) - Math.exp(-((x - 4.36) ** 2) / 0.4));
const belt = (x: number) => crown(x) + 0.085;
const cabinWidth = (x: number) => width(x) * 0.83;
function top(x: number, v: number): Point {
  const z = v * width(x);
  const y =
    belt(x) +
    0.035 * (1 - v * v) +
    (0.055 * Math.exp(-((Math.abs(v) - 0.71) ** 2) / 0.008) * (1 - Math.tanh(x + 1))) / 2;
  return [endX(x, z), y - 0.085 * Math.max(0, (Math.abs(v) - 0.83) / 0.17), z];
}
export function coachwork(body: T.Group, roof: T.Group, doors: T.Group[], draw: Draw, axles: number[]) {
  const panel = (name: string) => {
    const part = new T.Group();
    part.name = name;
    body.add(part);
    return part;
  };
  const hood = panel('Bonnet');
  const decklid = panel('Decklid');
  const nose = -4.45,
    tail = 4.36,
    cowl = -1.08,
    deck = 2.99;
  for (const side of [-1, 1]) {
    const door = doors[side < 0 ? 0 : 1];
    const shut = (v: number) => 0.18 * (1 - v) ** 2;
    for (const [left, right, g] of [
      [nose, cowl, panel('Front fender ' + side)],
      [cowl, 1.49, door],
      [1.49, tail, panel('Rear quarter ' + side)],
    ] as const) {
      draw(
        g,
        skin(
          (u, v) => {
            const x = mix(
              left + (left === nose ? 0 : shut(v)) + 0.005,
              right + (right === tail ? 0 : shut(v)) - 0.005,
              u,
            );
            let sill = 0.33;
            for (const ax of axles) {
              const d = Math.abs(x - ax);
              if (d < 0.81) sill = Math.max(sill, 0.33 + 1.15 * Math.sqrt(1 - (d / 0.81) ** 2));
            }
            const z = side * (width(x) - 0.115 * (1 - v) ** 2 + 0.035 * Math.sin(v * Math.PI * 2));
            return [endX(x, z), mix(sill, crown(x), v), z];
          },
          100,
          9,
        ),
        'paint',
      );
      draw(
        g,
        skin((u, v) => top(mix(left + 0.005, right - 0.005, u), side * mix(0.83, 1, v)), 32, 5),
        'paint',
      );
    }
    // Folded sill and recessed wheelhouse returns give the panels a visible thickness.
    draw(
      door,
      stamping(
        [
          [-0.9, 0.33],
          [-0.76, 0.29],
          [1.49, 0.3],
          [1.6, 0.35],
          [1.56, 0.41],
          [-0.82, 0.38],
        ],
        0.115,
        0.015,
      ).translate(0, 0, side * 1.45 - 0.057),
      'trim',
    );
    for (const ax of axles)
      draw(
        body,
        skin(
          (u, v) => {
            const angle = Math.PI * u,
              x = ax + 0.81 * Math.cos(angle);
            return [x, 0.33 + 1.15 * Math.sin(angle), side * (width(x) - 0.115 - v * 0.47)];
          },
          44,
          2,
        ),
        'trim',
        false,
      );
    // Bonnet extractor follows the local crown. Three raised vanes break up its throat.
    const extractor = (u: number, v: number, raise: number): Point => {
      const p = top(-2.72 + 0.71 * u, side * (0.57 + 0.13 * v * (0.45 + 0.55 * Math.sin(Math.PI * u)) + 0.06 * u));
      p[1] += raise;
      return p;
    };
    draw(
      hood,
      skin((u, v) => extractor(u, v, 0.012), 20, 4),
      'trim',
    );
    for (const t of [0.21, 0.43, 0.65, 0.86])
      draw(
        hood,
        skin((u, v) => extractor(t + u * 0.036 + v * 0.08, v, 0.019), 3, 4),
        'disc',
        false,
      );
    draw(door, oval(1.21, belt(1.21) - 0.2, side * width(1.21), 0.135, 0.028, 0.035), 'chrome');
    draw(
      door,
      pipe(
        [
          [-0.78, 1.53, side * 1.38],
          [-0.72, 1.68, side * 1.62],
          [-0.63, 1.69, side * 1.69],
        ],
        0.035,
      ),
      'trim',
    );
    draw(door, oval(-0.64, 1.72, side * 1.72, 0.18, 0.085, 0.13), 'paint');
  }
  for (const [a, b] of [
    [nose, cowl],
    [deck, tail],
  ])
    draw(
      a === nose ? hood : decklid,
      skin((u, v) => top(mix(a, b, u), mix(-0.83, 0.83, v))),
      'paint',
    );
  // Curved trapezoidal glazing: the roof ends sweep back into the cant rails.
  const canopy = (u: number, v: number): Point => {
    const x = mix(cowl, deck, u);
    const arch = Math.sin(Math.PI * u);
    const lift = 0.94 * arch * (1 + 0.42 * (1 - arch));
    return [
      x + 0.08 * v * v * Math.sin(2 * Math.PI * u),
      belt(x) + lift * (1 - 0.1 * v * v) + 0.035 * (1 - v * v),
      v * (cabinWidth(x) - 0.39 * lift),
    ];
  };
  for (const [a, b, finish] of [
    [0, 0.33, 'glass'],
    [0.33, 0.6, 'paint'],
    [0.6, 1, 'glass'],
  ] as const)
    draw(
      roof,
      skin((u, v) => canopy(mix(a, b, u), 2 * v - 1)),
      finish,
    );
  for (const side of [-1, 1]) {
    for (const [a, b, finish] of [
      [0, 0.038, 'paint'],
      [0.038, 0.566, 'glass'],
      [0.566, 0.592, 'trim'],
      [0.592, 0.82, 'glass'],
      [0.82, 1, 'paint'],
    ] as const)
      draw(
        roof,
        skin(
          (u, v) => {
            const t = mix(a, b, u),
              x = mix(cowl, deck, t),
              p = canopy(t, side);
            return [mix(x, p[0], v), mix(belt(x), p[1], v), mix(side * cabinWidth(x), p[2], v)];
          },
          20,
          3,
        ),
        finish,
      );
    draw(
      roof,
      pipe(
        Array.from({ length: 25 }, (_, i) => canopy(i / 24, side)),
        0.029,
      ),
      'paint',
    );
  }
  for (const x of [nose, tail]) {
    const front = x === nose;
    const bumper = panel(front ? 'Front fascia' : 'Diffuser and rear fascia');
    const fascia = (v: number, h: number, offset = 0): Point => {
      const z = v * (width(x) - 0.115 * (1 - h) ** 2 + 0.035 * Math.sin(h * Math.PI * 2));
      return [
        endX(x, z) + (front ? -1 : 1) * (offset + 0.075 * Math.sin(h * Math.PI) * (1 - v * v)),
        mix(0.32, top(x, v)[1], h),
        z,
      ];
    };
    draw(
      bumper,
      skin((u, v) => fascia(2 * u - 1, v), 36, 8),
      'paint',
    );
    draw(
      bumper,
      skin((u, v) => fascia((2 * u - 1) * mix(0.69, 0.78, v), mix(0.13, 0.56, v), 0.016)),
      'trim',
    );
    if (!front)
      for (const z of [-0.96, -0.48, 0, 0.48, 0.96]) {
        draw(
          bumper,
          stamping(
            [
              [3.65, 0.33],
              [4.31, 0.33],
              [4.29, 0.2],
              [4.08, 0.19],
            ],
            0.035,
            0.009,
          ).translate(0, 0, z),
          'trim',
        );
      }
    for (let i = 0; i < 5; i++)
      draw(
        bumper,
        skin((u, v) => fascia((2 * u - 1) * 0.68, 0.16 + i * 0.072 + v * 0.018, 0.024), 18, 1),
        front ? 'chrome' : 'trim',
        false,
      );
    for (const side of [-1, 1]) {
      if (front)
        draw(
          bumper,
          skin((u, v) => fascia(side * (0.78 + 0.18 * u - 0.03 * v), 0.19 + 0.1 * u + v * 0.27, 0.016), 14, 4),
          'trim',
        );
      draw(
        bumper,
        skin((u, v) =>
          fascia(side * mix(front ? 0.44 : 0.08, 0.99, u), 0.71 + 0.12 * u + v * (0.12 - 0.06 * u), 0.022),
        ),
        front ? 'head' : 'tail',
      );
      draw(
        bumper,
        skin((u, v) => {
          const p = top(x + (front ? 1 : -1) * u * 0.8, side * (0.81 + 0.095 * u + v * 0.14 * (1 - u)));
          p[1] += 0.012;
          return p;
        }),
        front ? 'head' : 'tail',
      );
    }
  }
  return { hood, decklid };
}
