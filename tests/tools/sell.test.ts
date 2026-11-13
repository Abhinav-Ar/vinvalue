import { describe, it, expect } from 'vitest';
import { buildListingKit, planSale } from '@/lib/sell';
import { caSmog } from '@/config/states/ca';
import { rulesFor, stateFromZip } from '@/config/states';
import { MUSTANG_SPECS } from './helpers';

const today = '2026-11-12';
const ca = rulesFor('CA');
const design = { instantValue: 23100, askingPrice: 27450, loanPayoff: 0, state: 'CA', rules: ca, modelYear: 2019, fuel: 'Gasoline', today };

describe('sell planner', () => {
  it('matches the design figures (CA, no payoff)', () => {
    const p = planSale(design);
    const [instant, trade, priv] = p.routes;
    expect(trade!.price).toBe(22400);
    expect(priv!.costs).toBe(250);
    expect(p.routes.map((r) => r.net)).toEqual([23100, 22400, 27200]);
    expect(p.best).toBe('private');
    expect(p.gap).toBe(4800);
    expect(instant!.time).toBe('Same day');
    expect(p.taxNote).toContain('no trade-in tax credit');
    expect(p.taxNote).toContain('$4,800');
    expect(p.disclaimer).toBe('Not tax or legal advice.');
    expect(p.stateRulesAvailable).toBe(true);
  });

  it('subtracts loan payoff from every route', () => {
    const p = planSale({ ...design, loanPayoff: 10000 });
    expect(p.routes.map((r) => r.net)).toEqual([13100, 12400, 17200]);
    expect(p.routes.every((r) => r.payoff === 10000)).toBe(true);
    expect(p.best).toBe('private');
    const under = planSale({ ...design, loanPayoff: 30000 });
    expect(under.routes[0]!.net).toBe(-6900);
  });

  it('picks instant when the private ask nets less', () => {
    expect(planSale({ ...design, askingPrice: 23000 }).best).toBe('instant');
  });

  it('CA smog rule boundary years, EV and diesel', () => {
    expect(caSmog({ modelYear: 2022, fuel: 'Gasoline', today }).required).toBe(false);
    expect(caSmog({ modelYear: 2021, fuel: 'Gasoline', today }).required).toBe(true);
    expect(caSmog({ modelYear: 2015, fuel: 'Electric', today }).required).toBe(false);
    const d = caSmog({ modelYear: 2015, fuel: 'Diesel', today });
    expect(d.required).toBe(true);
    expect(d.note).toContain('Diesel rules differ');
    expect(caSmog({ modelYear: 1970, fuel: 'Gasoline', today }).required).toBe(false);
    // No smog cost when exempt.
    expect(planSale({ ...design, modelYear: 2022 }).routes[2]!.costs).toBe(200);
    expect(planSale({ ...design, fuel: 'Electric' }).routes[2]!.costItems.some((c) => c.key === 'smogCert')).toBe(false);
  });

  it('CA checklist includes REG 138 within 5 days and insurance timing', () => {
    const p = planSale(design);
    const reg = p.checklist.find((c) => c.key === 'reg138')!;
    expect(reg.detail).toContain('REG 138');
    expect(reg.detail).toContain('5 days');
    expect(p.checklist.map((c) => c.key)).toEqual(['smog', 'title', 'bill_of_sale', 'reg138', 'insurance']);
  });

  it('unsupported state: generic checklist, no smog cost, flag false', () => {
    const p = planSale({ ...design, state: 'IL', rules: rulesFor('IL') });
    expect(p.stateRulesAvailable).toBe(false);
    expect(p.checklist.some((c) => c.key === 'reg138')).toBe(false);
    expect(p.routes[2]!.costs).toBe(200);
    expect(p.disclaimer).toBe('Not tax or legal advice.');
  });

  it('ZIP prefix to state', () => {
    expect(stateFromZip('94538')).toBe('CA');
    expect(stateFromZip('90210')).toBe('CA');
    expect(stateFromZip('60601')).toBe('IL');
    expect(stateFromZip('10001')).toBe('NY');
    expect(stateFromZip('00000')).toBeNull();
  });

  it('listing description draft', () => {
    const kit = buildListingKit({
      specs: { ...MUSTANG_SPECS, make: 'FORD' }, trim: 'GT', odometer: 38200, titleStatus: 'clean',
      hasServiceRecords: true, reportLink: 'https://autoiq.test/r/abc123',
    });
    expect(kit.descriptionDraft).toBe(
      '2019 Mustang GT coupe, 5.0L V8, 38,200 miles, clean title. Service records included. AutoIQ report with comparable listings: https://autoiq.test/r/abc123',
    );
    expect(kit.shotList).toHaveLength(8);
    const noRecords = buildListingKit({ specs: MUSTANG_SPECS, trim: 'GT', odometer: 38200, titleStatus: 'rebuilt', hasServiceRecords: false, reportLink: null });
    expect(noRecords.descriptionDraft).not.toContain('Service records');
    expect(noRecords.descriptionDraft).toContain('rebuilt title');
  });

  it('user-visible strings have no em dashes', () => {
    const s = JSON.stringify([planSale(design), planSale({ ...design, rules: null, state: null })]);
    expect(s).not.toMatch(/[—−]/);
  });
});
