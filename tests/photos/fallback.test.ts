import { createRequire } from 'node:module';
import { createElement } from 'react';
import { expect, it } from 'vitest';
import { VehiclePhoto } from '@/views/components/VehiclePhoto';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');
it('renders the token-styled illustration and a quiet caption without a photo', () => {
  const html = renderToStaticMarkup(createElement(VehiclePhoto, { car: { year: 2019, make: 'Tesla', model: 'Model 3' } }));
  expect(html).toContain('<svg');
  expect(html).toContain('var(--signal)');
  expect(html).toContain('<small>Vehicle illustration</small>');
  expect(html).not.toMatch(/unavailable|error|temporarily/i);
});
it('retains a real stored photo', () => {
  const html = renderToStaticMarkup(createElement(VehiclePhoto, { car: { storedPhoto: 'https://example.com/car.jpg' } }));
  expect(html).toContain('<img');
  expect(html).toContain('https://example.com/car.jpg');
  expect(html).not.toContain('<svg');
});
