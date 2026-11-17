/** Public view contracts. Monetary amounts are USD; dates are ISO strings. */
export type CollectionValues = { private: number; instant: number; retail: number };
export type HistoryItem = {
  id: string; vin: string; vehicleId: string | null; source: 'appraisal' | 'garage';
  label: string; createdAt: string; reportUrl: string | null; values: CollectionValues | null;
};
export type HistoryCollection = { items: HistoryItem[]; total: number; nextOffset: number | null };
export type DashboardData = {
  vehicles: HistoryItem[]; activity: HistoryItem[];
  totals: { vehicles: number; appraisals: number; valuedVehicles: number; privateValue: number; instantValue: number; retailValue: number };
};
export type BuyerGuideAnswer = { q: string; a: string; known: boolean };
export type BuyerGuide = { disclaimer: string; carvana: BuyerGuideAnswer[]; carmax: BuyerGuideAnswer[] };
export type BuyerGuideInput = {
  mileage?: number | null; accidents?: string | null; warningLights?: string | null;
  bodyDamage?: string | null; mechanicalIssues?: string | null; featuresWorking?: string | null;
  keys?: string | null; keysCount?: string | null; title?: string | null; titleStatus?: string | null;
  lien?: boolean | 'none' | 'has_lien' | 'unknown' | null; featureFailures?: string | null;
};
export type ExtensionCar = {
  id: string; vin: string; year: number; make: string; model: string; trim: string | null;
  mileage: number; zip: string; condition: string | null; trade_in: number | null;
  body_class: string | null; drive_type: string | null; fuel_type: string | null;
  transmission: string | null; cylinders: number | null;
  answers: Record<string, string | number | null>;
};
export type ExtensionGarage = { version: 1; accountId: string; cars: ExtensionCar[] };
