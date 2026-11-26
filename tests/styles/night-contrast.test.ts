import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('views/styles/globals.css', 'utf8');
const block = (re: RegExp) => css.match(re)![1]!;
const day = block(/\n\.bp\{([^}]+)\}/);
const night = block(/\[data-theme=night\] \.bp\{([^}]+)\}/);
const token = (src: string, name: string) => src.match(new RegExp(`--${name}:([^;]+)`))![1]!.trim();
const rgb = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16));
const luminance = (color: number[]) => color.map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i]!, 0);
const contrast = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

it.each([['day', day], ['night', night]])('keeps %s text, accent and action labels above AA', (_name, src) => {
  const paper = rgb(token(src, 'paper'));
  const surfaces = [paper, rgb(token(src, 'fill'))];
  for (const surface of surfaces) {
    for (const fg of ['ink', 'mid', 'blue']) expect(contrast(rgb(token(src, fg)), surface)).toBeGreaterThanOrEqual(4.5);
  }
  // Primary buttons: paper on ink, and onblue on the accent when hovered.
  expect(contrast(paper, rgb(token(src, 'ink')))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(rgb(token(src, 'onblue')), rgb(token(src, 'blue')))).toBeGreaterThanOrEqual(4.5);
});

it('uses no gradients anywhere in the global stylesheet', () => {
  expect(css).not.toMatch(/gradient\(/);
});
