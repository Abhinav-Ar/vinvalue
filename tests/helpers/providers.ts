import { setProviders } from '@/lib/providers';
import { fixtureProviders, type FixtureOptions } from '@/lib/providers/fixtures';

export { fixtureProviders, FIXTURE_VINS, type FixtureOptions } from '@/lib/providers/fixtures';

export function useFixtureProviders(opts: FixtureOptions = {}) {
  const p = fixtureProviders(opts);
  setProviders(p);
  return p;
}
