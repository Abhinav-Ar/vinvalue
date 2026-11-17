/**
 * Sell or trade planner (PURE: no DB, no HTTP, "today" injected).
 * Three routes, each net = price - costs - loan payoff:
 *   instant  latest instant value
 *   trade    instant x (1 + tradeInDiscountPct), rounded
 *   private  asking price (default latest private value) minus local selling costs
 */
import { sellConfig, type SellConfig } from '@/models/config/sell';
import {
  GENERIC_CHECKLIST, GENERIC_TAX_NOTE, type ChecklistItem, type StateRules,
} from '@/models/config/states';
import type { DecodedSpecs } from '@/models/db/schema';
import { roundTo } from '@/models/stats';

export type CostItem = { key: string; label: string; amount: number };
export type SellRoute = {
  key: 'instant' | 'trade' | 'private';
  name: string;
  price: number;
  costs: number;
  costItems: CostItem[];
  payoff: number;
  net: number;
  time: string;
  note: string;
};

export type SellPlan = {
  routes: SellRoute[];
  best: SellRoute['key'];
  /** Private net minus trade-in net. */
  gap: number;
  state: string | null;
  stateRulesAvailable: boolean;
  taxNote: string;
  checklist: ChecklistItem[];
  disclaimer: string;
};

export type PlanArgs = {
  instantValue: number;
  askingPrice: number;
  loanPayoff: number;
  state: string | null;
  rules: StateRules | null;
  modelYear: number;
  fuel: string | null;
  today: string;
  config?: SellConfig;
};

export function planSale(a: PlanArgs): SellPlan {
  const c = a.config ?? sellConfig;
  const ctx = { modelYear: a.modelYear, fuel: a.fuel, today: a.today };
  const smog = a.rules?.smog(ctx) ?? null;

  const privateItems: CostItem[] = [];
  if (smog?.required) privateItems.push({ key: 'smogCert', ...c.privateCosts.smogCert });
  privateItems.push({ key: 'detailing', ...c.privateCosts.detailing });
  privateItems.push({ key: 'listingFee', ...c.privateCosts.listingFee });

  const tradePrice = roundTo(a.instantValue * (1 + c.tradeInDiscountPct), c.tradeRoundTo);
  const tradeNote = a.rules
    ? a.rules.tradeInTaxCredit
      ? `Credit toward your next car. ${a.rules.name} reduces sales tax on your next car by the trade-in value.`
      : `Credit toward your next car. ${a.rules.name} still taxes the full price of the car you buy.`
    : 'Credit toward your next car. Some states reduce sales tax on your next car by the trade-in value.';
  const privateNote = smog?.required
    ? 'You list, show and sell it. You provide the smog certificate.'
    : 'You list, show and sell it.';

  const mk = (key: SellRoute['key'], name: string, price: number, costItems: CostItem[], note: string): SellRoute => {
    const costs = costItems.reduce((s, i) => s + i.amount, 0);
    return { key, name, price, costs, costItems, payoff: a.loanPayoff, net: price - costs - a.loanPayoff, time: c.times[key], note };
  };
  const routes = [
    mk('instant', 'Instant offer', a.instantValue, [], 'A dealer or online buyer pays now and handles the paperwork.'),
    mk('trade', 'Trade-in', tradePrice, [], tradeNote),
    mk('private', 'Private sale', a.askingPrice, privateItems, privateNote),
  ];
  let best = routes[0]!;
  for (const r of routes) if (r.net > best.net) best = r;
  const gap = routes[2]!.net - routes[1]!.net;

  let taxNote = a.rules?.taxNote ?? GENERIC_TAX_NOTE;
  if (a.rules && !a.rules.tradeInTaxCredit && gap > 0) {
    taxNote = `Selling privately nets ${usd(gap)} more than trading in. ${a.rules.taxNote}`;
  }

  return {
    routes,
    best: best.key,
    gap,
    state: a.state,
    stateRulesAvailable: !!a.rules,
    taxNote,
    checklist: a.rules ? a.rules.checklist(ctx) : GENERIC_CHECKLIST,
    disclaimer: c.disclaimer,
  };
}

export function usd(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
}

function titleCase(s: string) {
  return s.length > 3 && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

/** "Sport Utility Vehicle [SUV]/Multipurpose..." -> "sport utility vehicle". */
export function shortBody(body: string | null): string | null {
  if (!body) return null;
  return body.split('/')[0]!.replace(/\[.*?\]/g, '').trim().toLowerCase() || null;
}

export type ListingKit = { shotList: string[]; descriptionDraft: string; reportLink: string | null };

export function buildListingKit(a: {
  specs: DecodedSpecs;
  trim: string | null;
  odometer: number;
  titleStatus: 'clean' | 'rebuilt' | 'salvage' | null;
  hasServiceRecords: boolean;
  reportLink: string | null;
  config?: SellConfig;
}): ListingKit {
  const c = a.config ?? sellConfig;
  const s = a.specs;
  const head = [String(s.year), titleCase(s.model), a.trim, shortBody(s.body)].filter(Boolean).join(' ');
  const parts = [head, s.engine, `${a.odometer.toLocaleString('en-US')} miles`];
  if (a.titleStatus) parts.push(`${a.titleStatus} title`);
  let d = parts.filter(Boolean).join(', ') + '.';
  if (a.hasServiceRecords) d += ' Service records included.';
  if (a.reportLink) d += ` AutoIQ report with comparable listings: ${a.reportLink}`;
  return { shotList: [...c.shotList], descriptionDraft: d, reportLink: a.reportLink };
}
