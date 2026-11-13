export const usd = (n: number | null | undefined) => (n == null ? '–' : '$' + Math.round(n).toLocaleString('en-US'));
export const usdSigned = (n: number) => (n >= 0 ? '+' : '−') + usd(Math.abs(n));
export const miles = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n).toLocaleString('en-US')} mi`);
export const num = (n: number | null | undefined) => (n == null ? '–' : Math.round(n).toLocaleString('en-US'));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-18" -> "Nov 18" (no timezone shifts: parses the date parts). */
export const shortDate = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MON[(m ?? 1) - 1]} ${d}`;
};
export const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MON[(m ?? 1) - 1]} ${d}, ${y}`;
};
