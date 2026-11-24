import * as T from 'three';
import { oval, pipe, skin, stamping, type Draw, type Point } from './surfaces';
import type { PartId } from './parts';

function turning(profile: number[][], x: number, y: number, z: number) {
  return new T.LatheGeometry(
    profile.map(([a, r]) => new T.Vector2(r, a)),
    32,
  )
    .rotateZ(-Math.PI / 2)
    .translate(x, y, z);
}
export function mechanicals(group: (id: PartId) => T.Group, chassis: T.Group, draw: Draw, axles: number[]) {
  const engine = group('engine'),
    drive = group('drivetrain'),
    seats = group('interior'),
    fuel = group('fuel');
  const cast = (x: number, y: number, z: number, length: number, height: number, width: number) =>
    stamping(
      [
        [0, 0.12 * height],
        [0.09 * length, 0],
        [0.88 * length, 0],
        [length, 0.25 * height],
        [0.94 * length, 0.86 * height],
        [0.81 * length, height],
        [0.12 * length, height],
        [0, 0.78 * height],
      ],
      width,
      0.022,
    ).translate(x, y, z - width / 2);
  draw(
    chassis,
    stamping(
      [
        [-1.76, -1.15],
        [-1.4, -1.36],
        [1.45, -1.36],
        [2, -0.92],
        [2, 0.92],
        [1.45, 1.36],
        [-1.4, 1.36],
        [-1.76, 1.15],
      ],
      0.08,
    )
      .rotateX(-Math.PI / 2)
      .translate(0, 0.38, 0),
    'trim',
  );
  for (const side of [-1, 1]) {
    draw(
      chassis,
      stamping(
        [
          [-3.8, 0.59],
          [-2.45, 0.64],
          [-1.55, 0.39],
          [1.38, 0.39],
          [2.05, 0.64],
          [3.65, 0.61],
          [3.65, 0.76],
          [2, 0.82],
          [1.32, 0.56],
          [-1.52, 0.56],
          [-2.4, 0.8],
          [-3.8, 0.72],
        ],
        0.14,
      ).translate(0, 0, side * 0.92 - 0.07),
      'disc',
    );
    for (const ax of axles) {
      for (const y of [0.49, 0.85])
        draw(
          chassis,
          pipe(
            [
              [ax - 0.32, y, side * 0.88],
              [ax - 0.11, y - 0.035, side * 1.3],
              [ax, y, side * 1.46],
              [ax + 0.3, y, side * 0.88],
            ],
            0.043,
          ),
          'disc',
        );
      draw(chassis, cast(ax - 0.075, 0.43, side * 1.43, 0.15, 0.55, 0.12), 'disc');
      const spring: Point[] = Array.from({ length: 77 }, (_, i) => [
        ax + 0.077 * Math.cos((i * Math.PI) / 6),
        0.58 + i * 0.008,
        side * (1.34 - i * 0.003 + 0.077 * Math.sin((i * Math.PI) / 6)),
      ]);
      draw(chassis, pipe(spring, 0.018, 100, 6), 'caliper', false);
      draw(
        chassis,
        pipe(
          [
            [ax, 0.53, side * 1.36],
            [ax, 1.24, side * 1.09],
          ],
          0.047,
        ),
        'chrome',
      );
    }
    for (const ax of axles)
      draw(
        chassis,
        pipe(
          [
            [ax - 0.03, 0.58, side * 1.31],
            [ax + 0.3, 0.55, side * 1.05],
            [ax + 0.36, 0.58, 0],
          ],
          0.028,
        ),
        'trim',
      );
  }
  for (const x of [-2.9, -2.25, -1.32, 0.78, 2.14, 2.78]) draw(chassis, cast(x, 0.51, 0, 0.14, 0.12, 1.95), 'disc');
  draw(engine, cast(-2.67, 0.57, 0, 1.17, 0.48, 0.58), 'disc');
  draw(engine, cast(-2.58, 0.4, 0, 1.02, 0.19, 0.48), 'trim');
  for (const side of [-1, 1]) {
    for (const [y, w, h, finish] of [
      [0.84, 0.34, 0.25, 'disc'],
      [1.05, 0.37, 0.13, 'trim'],
    ] as const)
      draw(
        engine,
        cast(-2.73, 0, 0, 1.29, h, w)
          .rotateX(side * 0.37)
          .translate(0, y, side * 0.31),
        finish,
      );
    for (let i = 0; i < 4; i++) {
      const x = -2.53 + i * 0.277;
      draw(
        engine,
        pipe(
          [
            [x, 1.22, 0],
            [x - 0.035, 1.29, side * 0.23],
            [x, 1.14, side * 0.39],
          ],
          0.061,
        ),
        'chrome',
      );
      draw(
        engine,
        pipe(
          [
            [x, 0.98, side * 0.46],
            [x + 0.045, 0.86, side * 0.57],
            [x + 0.17, 0.64, side * 0.6],
            [-1.39, 0.48, side * 0.53],
          ],
          0.041,
        ),
        'disc',
      );
    }
  }
  draw(engine, oval(-2.09, 1.24, 0, 0.56, 0.11, 0.17), 'trim');
  draw(
    drive,
    turning(
      [
        [0, 0.1],
        [0.02, 0.33],
        [0.16, 0.34],
        [0.28, 0.24],
        [0.54, 0.21],
        [0.61, 0.18],
        [0.87, 0.15],
        [0.94, 0.08],
      ],
      -1.5,
      0.71,
      0,
    ),
    'disc',
  );
  draw(
    drive,
    turning(
      [
        [0, 0.07],
        [0.09, 0.105],
        [0.14, 0.065],
        [2.67, 0.065],
        [2.73, 0.11],
        [2.83, 0.08],
      ],
      -0.56,
      0.71,
      0,
    ),
    'chrome',
  );
  draw(drive, oval(axles[1], 0.69, 0, 0.31, 0.22, 0.26), 'disc');
  for (const side of [-1, 1]) {
    draw(
      drive,
      pipe(
        [
          [axles[1], 0.69, 0],
          [axles[1], 0.69, side * 1.48],
        ],
        0.05,
      ),
      'chrome',
    );
    for (const z of [0.38, 1.22]) {
      const boot = turning(
        [
          [0, 0.055],
          [0.02, 0.1],
          [0.045, 0.07],
          [0.065, 0.115],
          [0.09, 0.073],
          [0.12, 0.12],
          [0.15, 0.075],
        ],
        0,
        0,
        0,
      );
      draw(drive, boot.rotateY((-side * Math.PI) / 2).translate(axles[1], 0.69, side * z), 'trim');
    }
    draw(
      fuel,
      pipe(
        [
          [-1.42, 0.48, side * 0.53],
          [-0.8, 0.32, side * 0.34],
          [1.65, 0.32, side * 0.39],
          [2.45, 0.38, side * 0.62],
          [3.8, 0.44, side * 0.83],
          [4.37, 0.43, side * 0.85],
        ],
        0.057,
      ),
      'chrome',
    );
    for (const [x, l, z] of [
      [-0.51, 0.27, 0.35],
      [3.59, 0.39, 0.81],
    ])
      draw(fuel, oval(x, 0.38, side * z, l, 0.13, 0.16), 'disc');
    draw(
      fuel,
      turning(
        [
          [0, 0.067],
          [0.19, 0.082],
          [0.2, 0.065],
          [0.03, 0.053],
        ],
        4.19,
        0.43,
        side * 0.85,
      ),
      'chrome',
    );
  }
  draw(fuel, cast(1.52, 0.82, 0, 1.36, 0.29, 1.34), 'trim');
  const radiator = cast(-3.69, 0.53, 0, 0.16, 0.49, 1.65);
  draw(engine, radiator, 'trim');
  for (let i = 0; i < 12; i++)
    draw(
      engine,
      pipe(
        [
          [-3.719, 0.55 + 0.039 * i, -0.77],
          [-3.719, 0.55 + 0.039 * i, 0.77],
        ],
        0.012,
        1,
        5,
      ),
      'disc',
      false,
    );
  for (const z of [-0.41, 0.41])
    for (let i = 0; i < 6; i++) {
      const blade = oval(0, 0.096, 0.054, 0.028, 0.136, 0.067)
        .rotateX((i * Math.PI) / 3)
        .translate(-3.48, 0.78, z);
      draw(engine, blade, 'disc', false);
    }
  draw(engine, cast(-1.76, 0.83, -0.86, 0.46, 0.29, 0.31), 'trim');
  draw(engine, cast(-1.79, 1.1, -0.86, 0.49, 0.065, 0.34), 'disc');
  for (const z of [-0.96, -0.76])
    draw(
      engine,
      pipe(
        [
          [-1.64, 1.14, z],
          [-1.56, 1.2, z],
          [-1.38, 1.08, z],
          [-1.1, 0.89, -0.92],
        ],
        0.021,
      ),
      'caliper',
    );
  for (const side of [-1, 1]) {
    const z = side * 0.65;
    for (const off of [-0.26, 0.26]) draw(seats, cast(-0.08, 0.46, z + off, 1.04, 0.065, 0.07), 'chrome');
    // Bucket cushion has a thigh roll, depressed centre and raised lateral supports.
    draw(
      seats,
      skin(
        (u, v) => {
          const a = 2 * Math.PI * v,
            radius = Math.sin(Math.PI * u) ** 0.4;
          const lateral = Math.cos(a) * radius;
          return [
            -0.09 + u * 0.99,
            0.66 + Math.sin(a) * radius * 0.135 + 0.078 * lateral * lateral + 0.043 * (1 - u) ** 3,
            z + lateral * (0.3 + 0.045 * (1 - u)),
          ];
        },
        24,
        28,
      ),
      'trim',
    );
    draw(seats, oval(0, 0, 0, 0.13, 0.52, 0.3).rotateZ(-0.23).translate(0.84, 1.14, z), 'trim');
    for (const off of [-0.28, 0.28]) {
      draw(seats, oval(0.4, 0.73, z + off, 0.48, 0.13, 0.092), 'trim');
      draw(
        seats,
        oval(0, 0, 0, 0.16, 0.42, 0.095)
          .rotateZ(-0.23)
          .translate(0.8, 1.17, z + off),
        'trim',
      );
    }
    draw(seats, oval(0.98, 1.72, z, 0.105, 0.17, 0.22), 'trim');
  }
  draw(
    seats,
    skin(
      (u, v) => {
        const lateral = 2 * u - 1,
          a = v * 2 * Math.PI,
          r = Math.sin(Math.PI * u) ** 0.2;
        return [
          -0.93 + 0.27 * r * Math.cos(a) - 0.14 * lateral * lateral,
          1.34 + 0.14 * r * Math.sin(a),
          1.24 * lateral,
        ];
      },
      30,
      24,
    ),
    'trim',
  );
  draw(seats, oval(-0.77, 1.49, 0.64, 0.28, 0.14, 0.38), 'trim');
  draw(group('vin'), cast(-1.03, 1.475, -0.93, 0.16, 0.012, 0.085), 'chrome');
  draw(
    seats,
    pipe(
      [
        [-2.67, 0.64, -1.22],
        [-2.67, 0.64, 1.22],
      ],
      0.055,
    ),
    'disc',
  );
  draw(
    seats,
    pipe(
      [
        [-2.67, 0.64, 0.55],
        [-1.18, 0.91, 0.62],
        [-0.43, 1.43, 0.64],
      ],
      0.044,
    ),
    'disc',
  );
  draw(seats, new T.TorusGeometry(0.23, 0.028, 9, 44).rotateY(1.34).translate(-0.43, 1.43, 0.64), 'trim');
  for (const a of [0, Math.PI, 1.5 * Math.PI])
    draw(
      seats,
      pipe(
        [
          [-0.43, 1.43, 0.64],
          [-0.43 + 0.05 * Math.cos(a), 1.43 + 0.21 * Math.sin(a), 0.64 - 0.21 * Math.cos(a)],
        ],
        0.027,
      ),
      'chrome',
    );
  draw(seats, cast(-0.67, 0.48, 0, 1.58, 0.34, 0.34), 'trim');
  draw(
    seats,
    pipe(
      [
        [-0.28, 0.79, 0],
        [-0.25, 0.99, 0],
      ],
      0.031,
    ),
    'chrome',
  );
  draw(seats, oval(-0.25, 1, 0, 0.062, 0.066, 0.049), 'trim');
  for (const z of [0.48, 0.73]) draw(seats, cast(-0.96, 0.68, z, 0.095, 0.16, 0.11), 'disc');
}
