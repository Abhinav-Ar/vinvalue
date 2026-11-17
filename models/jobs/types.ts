/** Counts only. Never ids, VINs, ZIPs, emails or phones. */
export type JobReport = {
  job: 'daily' | 'weekly';
  startedAt: string;
  ms: number;
  counts: Record<string, number>;
};

export function counter() {
  const counts: Record<string, number> = {};
  return {
    counts,
    add(key: string, n = 1) {
      counts[key] = (counts[key] ?? 0) + n;
    },
  };
}
