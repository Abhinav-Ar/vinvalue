/**
 * Price check verdict (PURE).
 * fair range = retail range for dealer sellers, private range for private sellers.
 * below: ask < low; fair: low <= ask <= high; above: ask > high.
 * suggested first offer = round to $50 of min(ask - offerAskDiscount, mid - offerMidDiscount).
 */
import type { BuyVerdict, ValueRange } from '@/lib/db/schema';
import { roundTo } from '@/lib/stats';

export const buyConfig = {
  offerAskDiscount: 700,
  offerMidDiscount: 300,
  offerRoundTo: 50,
  compareMax: 3,
} as const;

export type VerdictKind = BuyVerdict['verdict'];

export function verdictFor(ask: number, low: number, high: number): VerdictKind {
  if (ask < low) return 'below';
  if (ask <= high) return 'fair';
  return 'above';
}

export function suggestedOffer(ask: number, mid: number, c = buyConfig): number {
  return Math.max(0, roundTo(Math.min(ask - c.offerAskDiscount, mid - c.offerMidDiscount), c.offerRoundTo));
}

export const VERDICT_TEXT: Record<VerdictKind, { label: string; note: string }> = {
  below: { label: 'Below market', note: 'Great price if the history checks out. Ask why it is cheap.' },
  fair: { label: 'Fair price', note: 'In line with similar cars near you. There is still room to ask.' },
  above: { label: 'Above market', note: 'Similar cars near you sell for less. Negotiate or keep looking.' },
};

export function buildVerdict(a: {
  askingPrice: number;
  sellerType: 'dealer' | 'private';
  privateRange: ValueRange;
  retailRange: ValueRange;
  compCount: number;
  computedAt: string;
}): BuyVerdict {
  const r = a.sellerType === 'dealer' ? a.retailRange : a.privateRange;
  const mid = Math.round((r.low + r.high) / 2);
  return {
    fairLow: r.low,
    fairHigh: r.high,
    mid,
    verdict: verdictFor(a.askingPrice, r.low, r.high),
    suggestedOffer: suggestedOffer(a.askingPrice, mid),
    compCount: a.compCount,
    computedAt: a.computedAt,
  };
}

export const SELLER_QUESTIONS = [
  'Do you have service records, especially oil changes and brakes?',
  'Has it been in any accidents or had paint work?',
  'Any warning lights now or in the past year?',
  'Is the title in your name, with no lien?',
  'Can I take it to a mechanic for an inspection?',
];
