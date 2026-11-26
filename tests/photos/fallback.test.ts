import { createRequire } from 'node:module';
import { createElement } from 'react';
import { expect, it } from 'vitest';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');
it('renders an accessible body-style line drawing without a visible fallback caption', () => {
  const html = renderToStaticMarkup(createElement(VehiclePhoto, { car: { year: 2019, make: 'Tesla', model: 'Model 3' } }));
  expect(html).toContain('<svg');
  expect(html).toContain('var(--fill)');
  expect(html).not.toContain('Line drawing · no photo found');
  expect(html).toContain('2019 Tesla Model 3, line drawing');
  expect(html).not.toMatch(/unavailable|error|temporarily/i);
});
it('retains a real stored photo', () => {
  const html = renderToStaticMarkup(createElement(VehiclePhoto, { car: { storedPhoto: 'https://example.com/car.jpg' } }));
  expect(html).toContain('<img');
  expect(html).toContain('https://example.com/car.jpg');
  expect(html).not.toContain('<svg');
});
