import { describe, it, expect, beforeEach } from 'vitest';
import { createUser } from '../helpers/db';
import { fixtureProviders } from '../helpers/providers';
import type { Db } from '@/models/db';
import { alerts, recallChecks, type RecallItem } from '@/models/db/schema';
import type { Providers } from '@/models/providers';
import { checkRecalls, formatComponent } from '@/models/recalls/service';
import { createAlerts } from '@/models/alerts/service';
import { addVehicle, freshDb } from './helpers';

let db: Db;
let userId: string;
const NOW = new Date('2026-11-16T10:00:00Z');

beforeEach(async () => {
  db = await freshDb();
  userId = (await createUser(db)).id;
}, 120000);

describe('checkRecalls (recorded NHTSA fixture, Ford Mustang 2019)', () => {
  it('first-ever check alerts on every campaign, with model-year wording', async () => {
    const v = await addVehicle(db, userId);
    const r = await checkRecalls(db, fixtureProviders(), v.id, NOW);
    expect(r.newCampaigns.map((c) => c.campaign).sort()).toEqual(['19V076000', '20V263000', '22V382000', '25V442000', '25V572000', '26V372000']);
    const d = r.drafts.find((x) => x.dedupeKey === `recall:${v.id}:20V263000`)!;
    expect(d).toMatchObject({ type: 'recall', title: 'New recall notice to review', vehicleId: v.id, userId });
    expect(d.body).toContain('may apply to the 2019 Ford Mustang model year');
    expect(d.body).toContain('nhtsa.gov/recalls');
    expect(d.body).toContain('Power train, automatic transmission');
    expect(d.body).not.toMatch(/—/);
    const checks = await db.select().from(recallChecks);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ basis: 'model_year' });
    expect(checks[0]!.results).toHaveLength(6);
  });

  it('later checks alert only on new campaigns; alerts dedupe', async () => {
    const v = await addVehicle(db, userId);
    const base = fixtureProviders();
    const first = await checkRecalls(db, base, v.id, NOW);
    await createAlerts(db, first.drafts, NOW);
    expect((await checkRecalls(db, base, v.id, new Date(NOW.getTime() + 7 * 86400_000))).newCampaigns).toHaveLength(0);

    const extra: RecallItem = { campaign: '26V999000', component: 'AIR BAGS', summary: 's', consequence: 'c', remedy: 'r', reportedOn: null, parkIt: false, parkOutside: false };
    const withNew: Providers = { ...base, recalls: { byModelYear: async (...a) => [...(await base.recalls.byModelYear(...a)), extra] } };
    const third = await checkRecalls(db, withNew, v.id, new Date(NOW.getTime() + 14 * 86400_000));
    expect(third.newCampaigns.map((c) => c.campaign)).toEqual(['26V999000']);
    expect(third.drafts[0]!.body).toContain('(Air bags)');
    const res = await createAlerts(db, [...first.drafts, ...third.drafts], NOW);
    expect(res).toEqual({ created: 1, skippedDuplicates: 6, invalid: 0 });
    expect(await db.select().from(alerts)).toHaveLength(7);
  });

  it('uses vPIC make/model as stored (Supra fixture) and returns nothing when NHTSA has none', async () => {
    const supra = await addVehicle(db, userId, {
      vin: 'WZ1DB4C07LW000000',
      specs: { year: 2020, make: 'Toyota', model: 'Supra', trimRaw: null, trimCandidates: [], body: null, drive: null, engine: null, fuel: null, doors: 2, plant: null, checkDigitValid: true },
    });
    expect((await checkRecalls(db, fixtureProviders(), supra.id, NOW)).newCampaigns).toHaveLength(8);
    const none = await addVehicle(db, userId, {
      vin: '4T1B11HK5JU000000',
      specs: { year: 2018, make: 'Toyota', model: 'Camry', trimRaw: null, trimCandidates: [], body: null, drive: null, engine: null, fuel: null, doors: 4, plant: null, checkDigitValid: true },
    });
    expect((await checkRecalls(db, fixtureProviders(), none.id, NOW)).newCampaigns).toHaveLength(0);
  });

  it('formats components', () => {
    expect(formatComponent('ELECTRICAL SYSTEM: INSTRUMENT CLUSTER/PANEL')).toBe('Electrical system, instrument cluster/panel');
    expect(formatComponent('')).toBe('Not specified');
  });
});
