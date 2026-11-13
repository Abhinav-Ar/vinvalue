/** Stable key for a make/model/(trim) used by market snapshots and watches: "ford|mustang|gt". */
export function modelKey(make: string, model: string, trim?: string | null): string {
  const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return [n(make), n(model), trim ? n(trim) : ''].join('|');
}

export function parseModelKey(key: string): { make: string; model: string; trim: string | null } {
  const [make = '', model = '', trim = ''] = key.split('|');
  return { make, model, trim: trim || null };
}
