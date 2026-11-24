import { createElement } from 'react';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CAR_WHEELS, CarDrawing, type CarVariant } from '@/views/components/CarDrawing';
import { carVariant } from '@/views/components/appraise/session';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');

describe('VIN body classes', () => {
  it.each([
    ['Sedan/Saloon', 'sedan'], ['Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)', 'suv'],
    ['Crossover Utility Vehicle (CUV)', 'suv'], ['Pickup', 'truck'], ['Hatchback/Liftback/Notchback', 'hatch'],
    ['Coupe', 'gt'], ['Convertible/Cabriolet', 'roadster'], ['Minivan', 'suv'], ['Wagon', 'suv'], ['Van', 'suv'],
  ])('%s selects %s', (body, expected) => expect(carVariant('Unknown', body)).toBe(expected));

  it('uses the decoded body when a model has multiple styles', () => {
    expect(carVariant('Golf', 'Wagon')).toBe('suv');
    expect(carVariant('Camaro', 'Convertible/Cabriolet')).toBe('roadster');
    expect(carVariant('Camaro', 'Coupe')).toBe('muscle');
  });
});

it.each([
  ['F-150', 'truck'], ['Silverado', 'truck'], ['Ram 1500', 'truck'], ['Tacoma', 'truck'],
  ['Tundra', 'truck'], ['Ranger', 'truck'], ['Sierra', 'truck'], ['CR-V', 'suv'], ['RAV4', 'suv'],
  ['Explorer', 'suv'], ['Wrangler', 'suv'], ['4Runner', 'suv'], ['Tahoe', 'suv'], ['Model Y', 'suv'],
  ['Odyssey', 'suv'], ['Civic Hatchback', 'hatch'], ['Golf', 'hatch'], ['Model 3', 'sedan'],
  ['Camry', 'sedan'], ['Unknown', 'sedan'], ['Miata', 'roadster'], ['Challenger', 'muscle'],
])('%s falls back to %s', (model, expected) => {
  expect(carVariant(model)).toBe(expected);
  expect(carVariant(model, null)).toBe(expected);
  expect(carVariant(model, 'Other')).toBe(expected);
});

it.each(Object.keys(CAR_WHEELS) as CarVariant[])('%s renders two equal tires on the ground line', variant => {
  const svg = renderToStaticMarkup(createElement(CarDrawing, { variant }));
  const wheels = CAR_WHEELS[variant];
  expect(wheels).toHaveLength(2);
  expect(wheels[0].r).toBe(wheels[1].r);
  for (const { cx, cy, r } of wheels) {
    expect(Math.abs(cy + r - 330)).toBeLessThanOrEqual(2);
    expect(svg).toContain(`<circle cx="${cx}" cy="${cy}" r="${r}"`);
  }
});
