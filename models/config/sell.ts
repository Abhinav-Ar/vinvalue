/** Sell planner knobs. Costs are whole dollars. */
export const sellConfig = {
  /** Trade-in = instant x (1 + pct), rounded. Design: 23,100 -> 22,400. TODO(data source): dealer trade spreads. */
  tradeInDiscountPct: -0.03,
  tradeRoundTo: 100,
  /**
   * Private-sale costs. TODO(data source: local prices). Smog is only charged when the
   * state rules say the seller must provide a certificate.
   */
  privateCosts: {
    smogCert: { label: 'Smog certificate', amount: 50 },
    detailing: { label: 'Detailing', amount: 150 },
    listingFee: { label: 'Listing fee', amount: 50 },
  },
  times: { instant: 'Same day', trade: 'Same day', private: 'About 2 to 4 weeks' },
  shotList: [
    'Front three-quarter',
    'Rear three-quarter',
    'Driver side profile',
    'Dashboard + odometer',
    'Front seats',
    'Engine bay',
    'Each wheel',
    'Any damage, up close',
  ],
  disclaimer: 'Not tax or legal advice.',
} as const;

export type SellConfig = typeof sellConfig;
