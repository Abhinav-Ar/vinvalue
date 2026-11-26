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

/** Sloped-roof crossover: Model X / Model Y, Mach-E, Ioniq 5, RAV4, CR-V. */
export const crossover = draw({
  axles: [238, 736], radius: 74, spokes: 5, sill: 288, cladding: true,
  outline: 'M84 288 Q70 282 70 266 L74 240 L78 200 Q81 180 104 170 Q176 152 296 146 C336 118 370 96 418 88 C520 74 650 78 730 94 C780 104 816 124 848 150 L868 170 Q880 182 882 198 L886 248 Q896 258 892 274 L882 284 L828 288',
  panes: [
    'M314 147 C350 120 380 100 422 94 L486 91 L484 150 Z',
    'M496 91 Q590 86 650 94 L668 144 L494 150 Z',
    'M680 98 Q742 110 792 138 Q740 142 690 144 Z',
  ],
  reflections: 'M372 140 l36 -42 M388 141 l37 -43 M716 136 l28 -26',
  mirror: [326, 156], handles: [[450, 172], [630, 166]],
  panels: [
    'M90 182 Q170 158 296 152',
    'M78 200 l66 -12 -8 18 -60 9 Z M88 204 l46 -8',
    'M74 244 l64 -8 -3 18 -63 7',
    'M314 184 Q520 168 670 164 Q790 156 862 168',
    'M310 154 Q298 200 326 276 L486 274 Q494 224 488 152',
    'M494 274 L640 270 Q652 260 654 238 M668 148 Q684 158 680 180 L664 200',
    'M330 262 Q484 262 640 246',
    'M848 160 l26 22 4 30 -16 -6 -10 -26 Z',
    'M820 270 l64 -8 M834 279 l48 -6 M800 188 h20 v12 h-20 Z',
  ],
});

/** Minivan: short nose, tall box, sliding door. Sienna, Odyssey, Pacifica, Carnival, cargo vans. */
export const van = draw({
  axles: [236, 748], radius: 64, spokes: 5, sill: 296,
  outline: 'M80 296 Q66 290 66 274 L70 246 L76 214 Q80 196 100 188 Q160 172 250 166 C290 130 330 100 380 90 C420 84 520 80 640 80 C760 80 840 84 870 92 L884 98 L884 112 Q890 150 892 190 L894 252 Q902 262 898 280 L888 291 L822 296',
  panes: [
    'M266 166 C300 132 336 106 382 98 L404 97 L402 164 Z',
    'M416 96 Q520 90 620 90 L624 160 L414 164 Z',
    'M636 90 Q760 90 856 98 Q866 126 870 156 Q760 158 640 160 Z',
  ],
  reflections: 'M324 156 l40 -50 M340 157 l40 -52 M740 150 l40 -50',
  mirror: [276, 176], handles: [[420, 186], [600, 182]],
  panels: [
    'M84 198 Q160 176 252 172',
    'M72 220 l62 -12 -6 18 -58 8 Z',
    'M70 252 l60 -6 -2 18 -60 6',
    'M262 196 Q520 186 880 186',
    'M262 172 Q254 220 282 286 L404 284 Q410 230 404 170',
    'M414 284 L628 280 L632 168 M416 176 L628 172',
    'M640 200 L870 198',
    'M290 272 Q500 270 680 264',
    'M878 120 l10 6 4 70 -12 -4 Z',
    'M820 276 l72 -8 M834 286 l52 -6',
  ],
});

/** Long-roof wagon: Outback, V60/V90, Allroad, Golf SportWagen. */
export const wagon = draw({
  axles: [244, 734], radius: 64, spokes: 5, sill: 300,
  outline: 'M92 300 Q74 298 72 284 L75 250 Q77 226 96 212 C130 188 236 176 312 172 C350 146 392 110 444 102 C500 94 640 94 790 100 L842 104 L846 116 Q862 150 872 190 L886 200 L892 252 Q902 264 898 282 L888 296 L824 300',
  panes: [
    'M330 172 Q398 112 448 108 L506 106 L503 168 Z',
    'M516 106 Q590 104 650 106 L656 164 L514 168 Z',
    'M664 106 L792 108 Q820 108 830 120 Q840 140 846 160 Q760 164 668 164 Z',
  ],
  reflections: 'M392 160 l35 -42 M408 160 l37 -45 M740 156 l34 -40',
  mirror: [342, 178], handles: [[466, 190], [630, 184]],
  panels: [
    'M86 228 Q159 193 306 178',
    'M76 244 Q114 230 154 227 Q146 241 119 246 L76 254 Z',
    'M75 272 L153 265 L154 282 L81 287 Z',
    'M320 208 C454 201 603 190 700 186 Q800 180 880 190',
    'M333 176 C320 207 327 272 337 292 Q399 296 503 291',
    'M509 172 Q519 220 505 291 L640 287 Q652 281 656 258',
    'M450 96 Q600 88 800 96',
    'M860 170 l18 22 4 28 -14 -4 -10 -26 Z',
    'M808 290 Q865 291 896 280',
  ],
});

/** Modern two-door fastback coupe: GR86/BRZ, 4 Series, Civic Si coupe, RC. */
export const coupe = draw({
  axles: [252, 716], radius: 62, spokes: 5, sill: 300,
  outline: 'M98 300 Q78 298 76 284 L79 252 Q80 230 98 216 C136 192 240 184 330 178 C370 150 410 118 460 110 C520 102 580 104 630 116 C690 130 760 160 820 172 L864 178 Q886 182 892 200 L898 252 Q908 264 902 282 L892 296 L822 300',
  panes: [
    'M350 177 Q410 124 464 118 L540 116 L538 172 Z',
    'M552 116 Q600 118 636 130 Q676 146 700 160 Q640 166 552 170 Z',
  ],
  reflections: 'M410 168 l38 -44 M426 168 l38 -46',
  mirror: [362, 184], handles: [[500, 196]],
  panels: [
    'M92 226 Q170 198 320 184',
    'M80 246 Q118 232 160 228 Q152 242 124 248 L80 256 Z',
    'M79 274 L157 267 L158 284 L85 289 Z',
    'M340 212 C470 204 600 194 700 188 Q790 184 880 196',
    'M352 182 C340 212 346 272 356 292 Q470 296 560 291 Q570 240 556 176',
    'M360 280 Q500 278 640 262',
    'M830 172 l40 2 4 6',
    'M860 190 l26 4 6 20 -24 -6 Z',
    'M806 290 Q862 292 900 280',
  ],
});
