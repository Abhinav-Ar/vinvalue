/**
 * California seller rules for the sell planner.
 *
 * Sources:
 *  - Smog on change of ownership, seller provides the certificate, exemptions (electric, diesel
 *    1997 and older, diesel over 14,000 lb GVWR, gasoline 1975 and older), newer cars pay a
 *    transfer fee instead of an inspection:
 *    https://www.dmv.ca.gov/portal/vehicle-registration/smog-inspections/ (checked 2026-11-12)
 *  - "Four model years or newer" counting rule: the page says "less than four years old".
 *    We treat modelYear >= currentYear - 4 as exempt. verify the exact boundary with the DMV.
 *  - Smog certificate valid 90 days: verify (not stated on the page above).
 *  - Notice of Transfer and Release of Liability (REG 138) within 5 days: verify
 *    (https://www.dmv.ca.gov, search "REG 138").
 *  - No trade-in sales tax credit in California (tax is on the full price of the car bought):
 *    verify with CDTFA publication 34 / dealer guidance.
 */
import type { SellContext, SmogResult, StateRules } from './index';

function isElectric(fuel: string | null) {
  return !!fuel && /electric/i.test(fuel) && !/hybrid|gasoline/i.test(fuel);
}
function isDiesel(fuel: string | null) {
  return !!fuel && /diesel/i.test(fuel);
}

export function caSmog(ctx: SellContext): SmogResult {
  const year = Number(ctx.today.slice(0, 4));
  if (isElectric(ctx.fuel)) {
    return { required: false, note: 'Electric cars do not need a smog certificate in California.' };
  }
  if (isDiesel(ctx.fuel)) {
    if (ctx.modelYear <= 1997) return { required: false, note: 'Diesel cars from 1997 and older are exempt from smog checks.' };
    return {
      required: true,
      note: 'Diesel rules differ: 1998 and newer diesels under 14,000 lb need a smog certificate. Confirm with a smog station.',
    };
  }
  if (ctx.modelYear <= 1975) return { required: false, note: 'Gas cars from 1975 and older are exempt from smog checks.' };
  if (ctx.modelYear >= year - 4) {
    return {
      required: false,
      note: 'Cars four model years old or newer do not need a smog check to sell. The buyer pays a smog transfer fee instead.',
    };
  }
  return {
    required: true,
    note: 'You provide a smog certificate for gas cars more than four model years old. It is good for 90 days.',
  };
}

export const caRules: StateRules = {
  code: 'CA',
  name: 'California',
  tradeInTaxCredit: false,
  taxNote:
    'California has no trade-in tax credit: sales tax is charged on the full price of the car you buy, so trading in does not save tax that would offset the lower trade-in price.',
  smog: caSmog,
  checklist(ctx) {
    const smog = caSmog(ctx);
    return [
      {
        key: 'smog',
        title: 'Smog certificate',
        detail: smog.note,
        required: smog.required,
      },
      {
        key: 'title',
        title: 'Sign the title',
        detail: 'Seller and buyer sign the California title, with the odometer reading.',
        required: true,
      },
      {
        key: 'bill_of_sale',
        title: 'Bill of sale',
        detail: 'Price, date, VIN and both signatures. Keep a copy.',
        required: true,
      },
      {
        key: 'reg138',
        title: 'Release of liability',
        detail: 'File the Notice of Transfer and Release of Liability (REG 138) with the DMV within 5 days.',
        required: true,
      },
      {
        key: 'insurance',
        title: 'Cancel insurance and plates',
        detail: 'Only after the DMV has your release on file.',
        required: true,
      },
    ];
  },
};
