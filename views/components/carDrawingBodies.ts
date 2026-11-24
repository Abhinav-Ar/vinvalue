import type { Car, El } from './CarDrawing';

type Wheel = Car['wheels'][number];
const blue = 'var(--blue)';
const fill = 'var(--fill)';
const tone = 'var(--tone)';
const path = (d: string, w: number, t: number, fi?: string): El => ({ k: 'p', d, w, t, s: 1, fi });

function wheelGroup({ cx, cy, r }: Wheel, delay: number, spokes: number): El[] {
  const ring = (radius: number, t: number, fi?: string, o?: number): El =>
    ({ k: 'c', cx, cy, r: radius, w: 1.2, fi, o, s: 1, t: delay + t });
  const point = (fraction: number, angle: number) => {
    const a = angle * Math.PI / 180;
    return [(cx + fraction * r * Math.cos(a)).toFixed(1), (cy + fraction * r * Math.sin(a)).toFixed(1)].join(' ');
  };
  const rim = spokes === 6 ? 0.61 : 0.70;
  const parts = [
    ring(r, 0, 'var(--tire)'), ring(r - 5, .02, undefined, .45),
    path(`M${point(.84, 200)} A${r * .84} ${r * .84} 0 0 1 ${point(.84, 250)} M${point(.84, 284)} A${r * .84} ${r * .84} 0 0 1 ${point(.84, 337)}`, .8, delay + .04),
    ring(r * rim, .06, fill), ring(r * rim - 3, .08), ring(r * .39, .1, tone),
    path(`M${point(.40, -44)} A${r * .40} ${r * .40} 0 0 1 ${point(.40, 18)} L${point(.54, 18)} A${r * .54} ${r * .54} 0 0 0 ${point(.54, -44)} Z`, 1, delay + .12, blue),
  ];
  for (let i = 0; i < spokes; i++) {
    const a = i * 360 / spokes - 90;
    const spoke = `M${point(.12, a - 18)} L${point(rim - .05, a - 11)} L${point(rim - .05, a - 5)} L${point(.31, a)} L${point(rim - .05, a + 6)} L${point(rim - .05, a + 12)} L${point(.12, a + 19)} Z`;
    parts.push(path(spoke, 1.1, delay + .16 + i * .02, fill));
  }
  parts.push(ring(r * .16, .34, fill), ring(r * .065, .35, blue));
  for (let i = 0; i < spokes; i++) {
    const a = i * 2 * Math.PI / spokes;
    parts.push({ k: 'c', cx: cx + r * .115 * Math.sin(a), cy: cy - r * .115 * Math.cos(a), r: 1.2, fi: 'currentColor', t: delay + .37 });
  }
  return parts;
}

type Profile = {
  axles: [number, number]; radius: number; spokes: number; sill: number;
  // Clockwise from the front sill, ending at the back sill.
  outline: string; squareArches?: boolean; cladding?: boolean;
  panes: string[]; reflections: string; panels: string[];
  mirror: [number, number]; handles: [number, number][];
};

function draw(profile: Profile): Car {
  const { axles, radius, sill, panes, mirror: [mx, my] } = profile;
  const wheels = axles.map(cx => ({ cx, cy: 330 - radius, r: radius }));
  const cy = wheels[0].cy;
  // Travel right to left so each wheel opening cuts into the lower shell.
  function arch(cx: number, extra = 0) {
    const r = radius + 9 + extra;
    if (profile.squareArches) {
      return `${cx + r} ${sill} L${cx + r - 3} ${cy - 24} Q${cx + r - 4} ${cy - 32} ${cx + 53} ${cy - r + 4} Q${cx + 49} ${cy - r} ${cx + 42} ${cy - r} H${cx - 42} Q${cx - 49} ${cy - r} ${cx - 53} ${cy - r + 4} L${cx - r + 5} ${cy - 32} Q${cx - r + 2} ${cy - 27} ${cx - r + 2} ${cy - 18} L${cx - r} ${sill}`;
    }
    return `${cx + r} ${sill} V${cy} A${r} ${r} 0 0 0 ${cx - r} ${cy} V${sill}`;
  }
  const shell = `${profile.outline} L${arch(axles[1])} L${arch(axles[0])} Z`;
  const base: El[] = [{ k: 'p', d: 'M20 330 H980', w: 1, t: .2 }];
  const shadows: El[] = [];
  const body = [path(shell, 2, 0)];
  for (const { cx, r } of wheels) {
    const reach = r + 16;
    base.push({ k: 'p', d: `M${cx} ${cy - reach} V346`, st: blue, w: .8, da: '6 4 1 4', t: 1.4 },
      { k: 'p', d: `M${cx - reach} ${cy} h${2 * reach}`, st: blue, w: .8, t: 1.4 });
    const opening = arch(cx);
    shadows.push({ k: 'p', d: `M${opening} Z`, fi: 'var(--shade)', t: 1.5 },
      { k: 'e', cx, cy: 331, rx: r * .9, ry: 5, fi: 'var(--shade)', o: .7, t: 1.5 });
    if (profile.cladding) {
      body.push({ ...path(`M${arch(cx, 2.5)}`, 5, 1.48), st: tone });
    }
    body.push(path(`M${arch(cx, 5)}`, 1.1, 1.5));
  }
  base.push({ k: 'p', d: shell, fi: 'BODY', t: 1.2 });
  profile.panels.forEach((d, i) => body.push(path(d, 1.1, .7 + i * .04)));
  body.push(path(`M${mx} ${my} l-8 -5 q-5 -2 -18 -2 q-6 0 -6 5 l2 6 q7 3 22 1 l7 4 5 -1 Z`, 1.1, 1.3, fill));
  for (const [x, y] of profile.handles) {
    body.push(path(`M${x} ${y} q6 -2 22 -2 l-2 4 q-10 2 -19 1 Z`, 1.1, 1.32, tone));
  }
  const sillHatching: string[] = [];
  for (let x = axles[0] + radius + 18; x < axles[1] - radius - 23; x += 10) {
    sillHatching.push(`M${x} ${sill - 1} l4 -7`);
  }
  return {
    wheels, base, shadows, body,
    shadow: { k: 'e', cx: (axles[0] + axles[1]) / 2, cy: 332, rx: (axles[1] - axles[0]) / 2 + radius * 2, ry: 16, fi: 'SHAD', o: .5, t: 1.4 },
    ink: [{ d: shell, w: 1.1 }, ...panes.map(d => ({ d, w: .9 })),
      { d: sillHatching.join(' '), w: .6, o: .6 }],
    glass: [...panes.map(d => path(d, 1.4, .5, 'var(--glass)')),
      { k: 'p', d: profile.reflections, w: .8, st: blue, o: .55, t: 2 }],
    front: wheelGroup(wheels[0], .9, profile.spokes), rear: wheelGroup(wheels[1], 1, profile.spokes),
  };
}

export const sedan = draw({
  axles: [244, 724], radius: 65, spokes: 5, sill: 302,
  outline: 'M93 302 Q74 300 72 286 L75 249 Q77 225 96 210 C131 185 238 173 315 169 C351 145 392 106 441 98 C491 89 574 91 619 99 C669 108 716 141 761 162 L862 167 Q891 169 897 188 L905 251 Q916 263 910 281 L899 296 Q866 302 828 302',
  panes: [
    'M331 169 Q396 108 444 106 Q474 101 509 102 L505 166 Z',
    'M517 102 Q564 100 604 107 Q621 109 637 117 L654 157 L516 165 Z',
    'M644 119 Q680 134 710 153 L664 157 Z',
  ],
  reflections: 'M394 157 l35 -42 M410 158 l37 -45 M571 154 l31 -38',
  mirror: [344, 174], handles: [[466, 188],[632, 181]],
  panels: [
    'M86 226 Q159 191 306 176 M107 212 Q171 190 234 184',
    'M76 242 Q114 228 154 225 Q146 239 119 244 L76 252 Z M86 245 l52 -13',
    'M75 270 L153 263 L154 280 L81 285 Z M86 276 l52 -5',
    'M320 206 C454 199 603 184 687 180 Q780 170 857 182',
    'M333 174 C320 205 327 270 337 290 Q399 294 503 289',
    'M509 169 Q519 218 505 289 L625 285 Q637 279 642 256',
    'M658 161 Q677 168 677 179 L658 207',
    'M334 276 Q511 273 633 249 M321 296 L643 292',
    'M756 167 Q810 174 883 175 L890 187',
    'M835 184 Q866 184 897 193 L899 210 L858 201 Z M858 193 l35 7',
    'M901 251 L869 249 M808 288 Q865 289 905 276',
    'M783 199 q0 -3 4 -3 h17 q3 0 3 3 v11 h-24 Z',
  ],
});

export const suv = draw({
  axles: [240, 728], radius: 74, spokes: 5, sill: 290, cladding: true,
  outline: 'M81 290 Q69 283 70 268 L77 248 L81 204 Q83 184 105 175 Q174 157 295 153 L370 103 Q393 90 437 89 C538 84 745 87 808 93 L831 96 L829 105 Q848 137 865 182 L880 197 L884 251 Q895 258 891 276 L881 285 L824 290',
  panes: [
    'M313 154 L378 110 Q395 100 429 99 L486 97 L483 157 Z',
    'M496 97 Q581 95 636 98 L647 151 L494 157 Z',
    'M650 99 L795 104 Q811 123 816 141 Q757 148 661 151 Z',
  ],
  reflections: 'M373 148 l37 -43 M388 149 l38 -43 M711 140 l34 -34',
  mirror: [326, 163], handles: [[446, 177],[620, 171]],
  panels: [
    'M426 88 l9 -10 Q599 71 757 81 l12 9 M447 86 l4 -6 M744 81 l4 8',
    'M91 188 Q171 163 295 159 M79 206 l68 -12 -9 19 -58 9 Z M88 213 l48 -12',
    'M74 249 l65 -9 -3 19 -65 8 M82 252 l41 -6',
    'M320 188 Q521 171 664 167 Q779 154 854 164',
    'M316 161 Q302 207 333 277 L482 276 Q490 228 486 161',
    'M490 276 L627 273 Q638 264 640 243 M651 155 Q668 163 663 187 L648 209',
    'M334 263 Q484 263 637 247 M326 280 L639 276 L637 287 H328 Z',
    'M832 115 Q848 145 856 181 L864 193 L868 241',
    'M858 178 l19 18 4 34 -14 -4 -9 -28 Z M867 194 l8 26',
    'M814 272 l68 -8 M829 281 l51 -6 M792 169 h20 v12 h-20 Z',
  ],
});

export const truck = draw({
  axles: [212, 772], radius: 78, spokes: 6, sill: 282, squareArches: true, cladding: true,
  outline: 'M57 282 Q44 279 44 265 L46 247 L53 243 L54 174 Q54 158 70 155 L264 143 L339 81 Q352 70 373 69 Q475 63 575 70 Q589 71 590 86 L595 149 L601 148 L602 140 L933 140 Q941 140 941 148 L938 245 L951 249 L947 271 Q916 280 869 282',
  panes: [
    'M282 145 L347 88 Q355 80 375 79 L421 77 L420 146 Z',
    'M433 77 Q499 74 562 80 Q570 81 570 90 L572 146 L432 146 Z',
  ],
  reflections: 'M334 137 l40 -50 M350 137 l41 -51 M493 135 l40 -49',
  mirror: [302, 153], handles: [[384, 169],[540, 169]],
  panels: [
    'M58 166 L247 154 L265 148 M94 158 l124 -7',
    'M55 179 l66 -7 -6 25 -61 7 Z M60 187 l47 -5 M60 194 l46 -5',
    'M49 247 l62 -3 -1 18 -64 5 Z M60 242 v-31 l47 -5',
    'M288 173 Q290 198 306 261 Q348 264 422 262 L424 151',
    'M431 262 L567 261 Q579 253 578 238 L576 151',
    'M298 182 L575 181 M309 249 L570 246',
    'M300 272 L576 271 L568 282 H308 Z M325 277 h226',
    'M595 149 L595 275 M602 147 L601 272',
    'M604 148 L935 147 M605 156 L922 155 M608 178 L707 175 M848 172 L927 170',
    'M928 151 L924 241 M938 181 h-23 l-2 41 24 1 Z M918 196 l16 1 M918 215 h15',
    'M858 263 L938 256 M876 271 l52 -7 M632 173 h23 v15 h-23 Z',
  ],
});

export const hatch = draw({
  axles: [289, 729], radius: 62, spokes: 4, sill: 301,
  outline: 'M164 301 Q148 297 148 277 L151 255 Q148 231 168 210 Q196 183 318 164 Q360 123 405 103 Q444 86 538 90 L746 95 L775 100 L770 110 Q793 140 811 187 Q833 205 833 230 L835 254 Q845 266 839 284 L826 297 L806 301',
  panes: [
    'M334 165 Q376 122 414 110 Q449 100 491 100 L490 165 Z',
    'M501 100 Q583 98 638 102 L656 158 L501 165 Z',
    'M651 103 L739 107 Q757 127 770 147 Q718 155 667 157 Z',
  ],
  reflections: 'M389 156 l37 -42 M406 156 l39 -46 M694 144 l29 -32',
  mirror: [346, 173], handles: [[454, 185],[628, 179]],
  panels: [
    'M163 221 Q226 181 314 171 M152 241 Q175 222 211 213 L203 230 L155 250 Z M164 238 l35 -16',
    'M150 270 L211 256 L210 274 L154 283 Z M161 272 l37 -9',
    'M364 200 Q514 182 652 177 Q717 165 777 168',
    'M338 173 Q333 197 350 220 M362 256 Q364 282 374 289 L486 288 Q499 223 494 169',
    'M492 288 L632 284 Q646 272 652 246 M659 162 Q678 173 674 192 L664 211',
    'M370 272 Q510 266 644 247 M364 296 L652 290',
    'M761 109 Q787 146 800 185 M770 122 l15 27',
    'M787 167 Q803 176 816 194 L827 213 L812 213 L792 193 Z M798 182 l17 22',
    'M810 221 Q822 235 823 253 M805 277 l32 -8 M809 289 l22 -6',
    'M732 171 h19 l3 12 h-22 Z',
  ],
});
