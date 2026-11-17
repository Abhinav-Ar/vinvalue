import { setProviders } from '@/models/providers';
import { fixtureProviders, type FixtureOptions } from '@/models/providers/fixtures';

export { fixtureProviders, FIXTURE_VINS, type FixtureOptions } from '@/models/providers/fixtures';

export function useFixtureProviders(opts: FixtureOptions = {}) {
  const p = fixtureProviders(opts);
  setProviders(p);
  return p;
}
