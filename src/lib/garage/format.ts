/** "$27,450" from whole dollars. */
export function fmtUsd(dollars: number): string {
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(dollars)).toLocaleString('en-US')}`;
}

/** "$386" or "$386.50" from integer cents. */
export function fmtCents(cents: number): string {
  const whole = cents % 100 === 0;
  const v = Math.abs(cents) / 100;
  const s = whole ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? '-' : ''}$${s}`;
}

export function fmtMiles(n: number): string {
  return `${n.toLocaleString('en-US')} mi`;
}
