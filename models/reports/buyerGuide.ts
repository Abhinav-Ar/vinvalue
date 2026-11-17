import type { BuyerGuide, BuyerGuideAnswer, BuyerGuideInput } from '@/shared/collection';

/** Suggestions based on seller answers, never a buyer offer or verified inspection. */
export function buildBuyerGuide(input: BuyerGuideInput): BuyerGuide {
  const norm = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
  const detail = (v: unknown, none: string, healthy = ['none']) => {
    const s = norm(v); return !s || s === 'unknown' ? null : healthy.includes(s) ? none : String(v);
  };
  const accident = detail(input.accidents, 'No accidents', ['none', 'no']);
  const light = detail(input.warningLights, 'No', ['none']);
  const damage = detail(input.bodyDamage, 'No damage');
  const mechanical = detail(input.mechanicalIssues, 'No');
  const features = detail(input.featuresWorking ?? input.featureFailures, 'Yes, all working', ['yes', 'all', 'none']);
  const keys = ({two: '2', 'both sets': '2', one: '1', 'one set': '1', none: '0', 'no keys': '0'} as Record<string,string>)[norm(input.keys ?? input.keysCount)] ?? null;
  // A clean title does not establish that a loan has been paid off.
  const lien = typeof input.lien === 'boolean' ? input.lien : input.lien === 'none' ? false : input.lien === 'has_lien' ? true : norm(input.titleStatus) === 'lien' ? true : null;
  const miles = typeof input.mileage === 'number' && Number.isFinite(input.mileage) && input.mileage >= 0 ? `${input.mileage.toLocaleString('en-US')} miles` : null;
  const answer = (q: string, a: string | null): BuyerGuideAnswer => ({q, a: a ?? 'Unknown — confirm before answering', known: a !== null});
  return { disclaimer: 'Seller answers are self-reported. Confirm each answer with the buyer; this guide is not an offer or inspection.',
    carvana: [answer('Odometer reading', miles), answer('Any accidents on record?', accident), answer('Warning lights on?', light), answer('Visible body / paint damage?', damage), answer('Do all features work?', features), answer('Major mechanical problems?', mechanical), answer('Lien on the car?', lien === null ? null : lien ? 'Yes — has a lien' : 'No lien'), answer('Key fobs / remotes', keys)],
    carmax: [answer('Odometer reading', miles), answer('Accidents?', accident), answer('Known mechanical problems?', mechanical), answer('Warning or check engine lights?', light), answer('Exterior condition', damage), answer('Do all electronics work?', features), answer('Own it outright (no loan)?', lien === null ? null : lien ? 'No — has a lien' : 'Yes'), answer('Number of keys', keys)] };
}
