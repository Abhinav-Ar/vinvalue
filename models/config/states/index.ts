/**
 * State seller rules registry + ZIP -> state lookup.
 * Only California has rules today. Other states get the generic checklist and
 * stateRulesAvailable: false. Do not invent rules for states we have not verified.
 */
import { caRules } from './ca';

export type SellContext = { modelYear: number; fuel: string | null; today: string };
export type SmogResult = { required: boolean; note: string };
export type ChecklistItem = { key: string; title: string; detail: string; required: boolean };

export type StateRules = {
  code: string;
  name: string;
  tradeInTaxCredit: boolean;
  taxNote: string;
  smog(ctx: SellContext): SmogResult;
  checklist(ctx: SellContext): ChecklistItem[];
};

export const STATE_RULES: Record<string, StateRules> = { CA: caRules };

export function rulesFor(state: string | null | undefined): StateRules | null {
  return state ? STATE_RULES[state.toUpperCase()] ?? null : null;
}

/** Checklist for states without verified rules. */
export const GENERIC_CHECKLIST: ChecklistItem[] = [
  { key: 'title', title: 'Sign the title', detail: 'Sign the title over to the buyer and write the odometer reading. Check your state DMV for the exact steps.', required: true },
  { key: 'bill_of_sale', title: 'Bill of sale', detail: 'Price, date, VIN and both signatures. Keep a copy.', required: true },
  { key: 'release', title: 'Report the sale', detail: 'Tell your state DMV the car was sold, if your state has a release of liability form.', required: true },
  { key: 'inspection', title: 'Emissions or safety inspection', detail: 'Some states require one before a sale. Check your state DMV.', required: false },
  { key: 'insurance', title: 'Cancel insurance and plates', detail: 'Only after the sale is reported to the DMV.', required: true },
];
export const GENERIC_TAX_NOTE =
  'Trade-in tax rules vary by state. In many states the trade-in value reduces the sales tax on your next car, which narrows the gap. Check your state rules.';

/**
 * 3-digit ZIP prefix ranges -> state (USPS sectional centers). A handful of prefixes
 * straddle state lines; good enough to pick a rules table, and the caller can pass `state`.
 */
const ZIP3: [number, number, string][] = [
  [5, 5, 'NY'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 59, 'VT'],
  [60, 69, 'CT'], [70, 89, 'NJ'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'],
  [200, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'], [270, 289, 'NC'],
  [290, 299, 'SC'], [300, 319, 'GA'], [320, 349, 'FL'], [350, 369, 'AL'], [370, 385, 'TN'],
  [386, 397, 'MS'], [398, 399, 'GA'], [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'],
  [480, 499, 'MI'], [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [570, 577, 'SD'],
  [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'], [630, 658, 'MO'], [660, 679, 'KS'],
  [680, 693, 'NE'], [700, 714, 'LA'], [716, 729, 'AR'], [730, 749, 'OK'], [750, 799, 'TX'],
  [800, 816, 'CO'], [820, 831, 'WY'], [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'],
  [870, 884, 'NM'], [885, 885, 'TX'], [889, 898, 'NV'], [900, 961, 'CA'], [967, 968, 'HI'],
  [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
];

export function stateFromZip(zip: string): string | null {
  const p = Number(zip.slice(0, 3));
  if (!/^\d{3}/.test(zip)) return null;
  for (const [lo, hi, st] of ZIP3) if (p >= lo && p <= hi) return st;
  return null;
}
