import { it, expect } from 'vitest';
import { buildBuyerGuide } from '@/models/reports/buyerGuide';
it('preserves unknown answers including keys and lien, even on a clean title', () => {
  const g = buildBuyerGuide({ title: 'clean' });
  expect(g.carvana.every(a => !a.known)).toBe(true);
  expect(g.disclaimer).toContain('self-reported');
});
it('maps stored and legacy answers, handles zero mileage and explicit no keys without mutation', () => {
  const input = { mileage: 0, accidents: 'none', warningLights: 'None', bodyDamage: 'Major', mechanicalIssues: 'None', featuresWorking: 'Yes', keysCount: 'No keys', lien: false };
  const g = buildBuyerGuide(input);
  expect(g.carvana.map(a => a.a)).toEqual(['0 miles', 'No accidents', 'No', 'Major', 'Yes, all working', 'No', 'No lien', '0']);
  expect(g.carmax.at(-2)?.a).toBe('Yes');
  expect(input.keysCount).toBe('No keys');
  expect(buildBuyerGuide({ keys: 'one', titleStatus: 'Lien' }).carvana.at(-2)?.a).toContain('has a lien');
});
it('never invents mileage or a healthy answer for malformed/unknown fields', () => {
  const g = buildBuyerGuide({ mileage: NaN, keys: 'unexpected', mechanicalIssues: 'unknown', accidents: 'major' });
  expect(g.carvana[0]?.known).toBe(false);
  expect(g.carvana[1]?.a).toBe('major');
  expect(g.carvana.at(-1)?.known).toBe(false);
});
