/** Selectable parts of the AIQ-01 model and what each means for the value. No three.js import, so the page can use it without loading WebGL code. */

export type PartId = 'body' | 'glass' | 'frontWheel' | 'rearWheel' | 'engine' | 'drivetrain' | 'interior' | 'fuel' | 'vin';

/** What each part means for the number. Shown when a part is selected. */
export const PART_INFO: Record<PartId, { name: string; note: string }> = {
  vin: { name: 'VIN plate', note: 'Step 1 reads these 17 characters and decodes year, make, model and trim.' },
  engine: { name: 'Engine', note: 'Displacement, cylinders and fuel type come from the NHTSA VIN decode.' },
  drivetrain: { name: 'Drivetrain', note: 'FWD, RWD or AWD comes from the VIN decode and narrows which listings count as comparable.' },
  interior: { name: 'Interior', note: 'Seat, wheel and dash wear go into the condition grade you choose.' },
  fuel: { name: 'Fuel and exhaust', note: 'Fuel type comes from the VIN decode and keeps gas, hybrid and electric comparables apart.' },
  glass: { name: 'Glass and roof', note: 'Roof and glass options follow the trim the VIN decodes.' },
  frontWheel: { name: 'Front wheels and tires', note: 'Tread and wheel damage count toward condition. Mileage has its own adjustment.' },
  rearWheel: { name: 'Rear wheels and tires', note: 'Tread and wheel damage count toward condition. Mileage has its own adjustment.' },
  body: { name: 'Body', note: 'Panels and paint. Damage lowers the condition grade, and reported accidents adjust the value.' },
};
