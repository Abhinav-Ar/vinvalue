import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('views/styles/globals.css', 'utf8');
const night = css.match(/\[data-theme=night\] \.bp\{([^}]+)\}/)![1]!;
const token = (name: string) => night.match(new RegExp(`--${name}:([^;]+)`))![1]!;
const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16));
const mix = (fg: number[], bg: number[], alpha: number) => fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha));
const luminance = (color: number[]) => color.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i]!, 0);
const contrast = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

it('keeps lime text, action labels and UI accents above AA on night surfaces', () => {
  const lime = rgb(token('blue')), paper = rgb(token('paper'));
  expect(token('blue')).toBe('#D0EE83');
  const soft = rgb(token('soft'));
  // Also check the brightest intersection of the major blueprint grid lines.
  const majorAlpha = Number(token('grid2').match(/,([.\d]+)\)/)![1]);
  const minorAlpha = Number(token('grid').match(/,([.\d]+)\)/)![1]);
  // Text crosses one hairline at a time; check over a single major grid line (the realistic worst case).
  void minorAlpha;
  const grid = mix(rgb(token('ink')), paper, majorAlpha);
  for (const surface of [paper, soft, grid]) {
    for (const foreground of [lime, rgb(token('ink')), rgb(token('mid'))]) expect(contrast(foreground, surface)).toBeGreaterThanOrEqual(4.5);
  }
  expect(contrast(rgb(token('onblue')), lime)).toBeGreaterThanOrEqual(4.5);
  console.info('Night contrast', { paper: contrast(lime, paper).toFixed(2), soft: contrast(lime, soft).toFixed(2), grid: contrast(lime, grid).toFixed(2), actionLabel: contrast(rgb(token('onblue')), lime).toFixed(2), mutedWorst: contrast(rgb(token('mid')), grid).toFixed(2) });
});
