/**
 * Generic service intervals used when a vehicle (or its model) has no specific rows in
 * `service_intervals`. Conservative mainstream numbers for modern gasoline cars.
 *
 * TODO(data source: manufacturer intervals): replace with per-model manufacturer schedules
 * (stored as service_intervals rows with modelKey + source 'manufacturer').
 */
export type DefaultInterval = {
  type: string;
  title: string;
  everyMiles: number | null;
  everyMonths: number | null;
  source: 'default';
};

export const DEFAULT_SERVICE_INTERVALS: DefaultInterval[] = [
  { type: 'oil_filter', title: 'Oil + filter', everyMiles: 5_000, everyMonths: 6, source: 'default' },
  { type: 'tire_rotation', title: 'Tire rotation', everyMiles: 6_000, everyMonths: null, source: 'default' },
  { type: 'brake_fluid', title: 'Brake fluid flush', everyMiles: null, everyMonths: 24, source: 'default' },
  { type: 'brake_pads', title: 'Brake pads', everyMiles: 30_000, everyMonths: null, source: 'default' },
  { type: 'cabin_filter', title: 'Cabin air filter', everyMiles: 15_000, everyMonths: 12, source: 'default' },
  { type: 'coolant', title: 'Coolant check', everyMiles: null, everyMonths: 24, source: 'default' },
  { type: 'wipers', title: 'Wiper blades', everyMiles: null, everyMonths: 12, source: 'default' },
  { type: 'battery', title: 'Battery check', everyMiles: null, everyMonths: 12, source: 'default' },
];
