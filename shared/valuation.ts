/** Dependency-free valuation audit persisted inside the confidence JSON. */
export type ValuationAudit = {
  references?: unknown; parameters?: unknown;
  mode: 'comps' | 'model'; asOf: string; parameterVersion: string;
  referenceVintage: string | null; score: number; coverage: number;
  factors: string[]; notes: string[]; anchor: number; retention: number; mileageFactor: number;
  base: number; hLog: number; effectiveComps: number;
  normalizations: Array<{ id: string; ratio: number; residual: number; lambda: number; reason?: string }>;
};
