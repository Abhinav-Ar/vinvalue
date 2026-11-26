import { createElement } from 'react';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CAR_WHEELS, CarDrawing, type CarVariant } from '@/views/components/CarDrawing';
import { carVariant } from '@/views/components/vehicleBody';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server');

describe('NHTSA body classes alone', () => {
  it.each([
    ['Sedan/Saloon', 'sedan'], ['Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)', 'suv'],
    ['Crossover Utility Vehicle (CUV)', 'crossover'], ['Pickup', 'truck'], ['Hatchback/Liftback/Notchback', 'hatch'],
    ['Coupe', 'coupe'], ['Convertible/Cabriolet', 'roadster'], ['Minivan', 'van'], ['Wagon', 'wagon'],
    ['Van', 'van'], ['Cargo Van', 'van'], ['Roadster', 'roadster'], [null, 'sedan'], ['Other', 'sedan'],
  ])('%s selects %s', (body, expected) => expect(carVariant('Unknownmake', 'Unknown', body)).toBe(expected));
});

describe('known models', () => {
  it.each([
    // Tesla and EVs
    ['Tesla', 'Model X', 'crossover'], ['Tesla', 'Model Y', 'crossover'], ['Tesla', 'Model 3', 'sedan'],
    // Model S is a liftback, but the sedan drawing is the closer silhouette.
    ['Tesla', 'Model S', 'sedan'], ['Tesla', 'Cybertruck', 'truck'], ['Ford', 'Mustang Mach-E', 'crossover'],
    ['Hyundai', 'Ioniq 5', 'crossover'], ['Hyundai', 'Ioniq 6', 'sedan'], ['Kia', 'EV6', 'crossover'], ['Kia', 'EV9', 'crossover'],
    ['Rivian', 'R1T', 'truck'], ['Rivian', 'R1S', 'suv'], ['Lucid', 'Air', 'sedan'], ['Polestar', '2', 'sedan'],
    ['Chevrolet', 'Bolt EV', 'hatch'], ['Chevrolet', 'Bolt EUV', 'crossover'], ['Nissan', 'Leaf', 'hatch'], ['Nissan', 'Ariya', 'crossover'],
    ['Volkswagen', 'ID.4', 'crossover'], ['Volkswagen', 'ID. Buzz', 'van'], ['GMC', 'Hummer EV', 'suv'], ['Porsche', 'Taycan', 'sedan'],
    // Trucks
    ['Ford', 'F-150', 'truck'], ['Ford', 'F150 Lightning', 'truck'], ['Ford', 'F-250 Super Duty', 'truck'], ['Ford', 'Maverick', 'truck'],
    ['Ford', 'Ranger', 'truck'], ['Chevrolet', 'Silverado 1500', 'truck'], ['Chevrolet', 'Colorado', 'truck'], ['GMC', 'Sierra 2500HD', 'truck'],
    ['GMC', 'Canyon', 'truck'], ['Ram', '1500', 'truck'], ['Ram', '2500', 'truck'], ['Dodge', 'Ram 1500', 'truck'],
    ['Toyota', 'Tacoma', 'truck'], ['Toyota', 'Tundra', 'truck'], ['Nissan', 'Frontier', 'truck'], ['Nissan', 'Titan', 'truck'],
    ['Honda', 'Ridgeline', 'truck'], ['Jeep', 'Gladiator', 'truck'], ['Hyundai', 'Santa Cruz', 'truck'],
    // Boxy SUVs
    ['Jeep', 'Wrangler Unlimited', 'suv'], ['Jeep', 'Grand Cherokee', 'suv'], ['Toyota', '4Runner', 'suv'], ['Toyota', 'Land Cruiser', 'suv'],
    ['Toyota', 'Sequoia', 'suv'], ['Toyota', 'Highlander', 'suv'], ['Chevrolet', 'Tahoe', 'suv'], ['Chevrolet', 'Suburban', 'suv'],
    ['GMC', 'Yukon XL', 'suv'], ['Cadillac', 'Escalade', 'suv'], ['Ford', 'Explorer', 'suv'], ['Ford', 'Expedition', 'suv'],
    ['Ford', 'Bronco', 'suv'], ['Lincoln', 'Navigator', 'suv'], ['Kia', 'Telluride', 'suv'], ['Hyundai', 'Palisade', 'suv'],
    ['Honda', 'Pilot', 'suv'], ['Subaru', 'Ascent', 'suv'], ['Mazda', 'CX-90', 'suv'], ['Mercedes-Benz', 'G-Class', 'suv'],
    ['Mercedes-Benz', 'GLS 450', 'suv'], ['BMW', 'X5', 'suv'], ['BMW', 'X7', 'suv'], ['Audi', 'Q7', 'suv'], ['Volvo', 'XC90', 'suv'],
    ['Land Rover', 'Defender 110', 'suv'], ['Land Rover', 'Range Rover', 'suv'], ['Dodge', 'Durango', 'suv'], ['Nissan', 'Armada', 'suv'],
    // Crossovers
    ['Toyota', 'RAV4', 'crossover'], ['Toyota', 'RAV4 Hybrid', 'crossover'], ['Honda', 'CR-V', 'crossover'], ['Honda', 'CRV', 'crossover'],
    ['Honda', 'HR-V', 'crossover'], ['Nissan', 'Rogue', 'crossover'], ['Mazda', 'CX-5', 'crossover'], ['Mazda', 'CX-50', 'crossover'],
    ['Subaru', 'Forester', 'crossover'], ['Subaru', 'Crosstrek', 'crossover'], ['Ford', 'Escape', 'crossover'], ['Ford', 'Bronco Sport', 'crossover'],
    ['Ford', 'Edge', 'crossover'], ['Chevrolet', 'Equinox', 'crossover'], ['Chevrolet', 'Blazer', 'crossover'], ['Jeep', 'Compass', 'crossover'],
    ['Hyundai', 'Tucson', 'crossover'], ['Kia', 'Sportage', 'crossover'], ['Kia', 'Sorento', 'crossover'], ['Volkswagen', 'Tiguan', 'crossover'],
    ['Audi', 'Q5', 'crossover'], ['BMW', 'X3', 'crossover'], ['Mercedes-Benz', 'GLC 300', 'crossover'], ['Lexus', 'RX 350', 'crossover'],
    ['Lexus', 'NX 300', 'crossover'], ['Acura', 'RDX', 'crossover'], ['Acura', 'MDX', 'crossover'], ['Porsche', 'Macan', 'crossover'],
    ['Porsche', 'Cayenne', 'crossover'], ['Volvo', 'XC60', 'crossover'], ['Genesis', 'GV80', 'crossover'], ['Lamborghini', 'Urus', 'crossover'],
    ['Mini', 'Countryman', 'crossover'],
    // Vans
    ['Toyota', 'Sienna', 'van'], ['Honda', 'Odyssey', 'van'], ['Chrysler', 'Pacifica', 'van'], ['Kia', 'Carnival', 'van'],
    ['Dodge', 'Grand Caravan', 'van'], ['Ford', 'Transit-250', 'van'], ['Mercedes-Benz', 'Sprinter', 'van'], ['Ram', 'ProMaster', 'van'],
    // Wagons
    ['Subaru', 'Outback', 'wagon'], ['Volvo', 'V60', 'wagon'], ['Volvo', 'V90 Cross Country', 'wagon'], ['Audi', 'A4 allroad', 'wagon'],
    ['Volkswagen', 'Golf SportWagen', 'wagon'], ['Volkswagen', 'Golf Alltrack', 'wagon'],
    // Hatchbacks
    ['Volkswagen', 'Golf', 'hatch'], ['Volkswagen', 'GTI', 'hatch'], ['Honda', 'Fit', 'hatch'], ['Honda', 'Civic Hatchback', 'hatch'],
    ['Honda', 'Civic Type R', 'hatch'], ['Toyota', 'Prius', 'hatch'], ['Toyota', 'Corolla Hatchback', 'hatch'], ['Mini', 'Cooper S', 'hatch'],
    ['Hyundai', 'Veloster', 'hatch'], ['Kia', 'Soul', 'hatch'], ['Fiat', '500', 'hatch'],
    // Sedans
    ['Toyota', 'Camry', 'sedan'], ['Toyota', 'Corolla', 'sedan'], ['Honda', 'Civic', 'sedan'], ['Honda', 'Accord', 'sedan'],
    ['Nissan', 'Altima', 'sedan'], ['Hyundai', 'Elantra', 'sedan'], ['Kia', 'K5', 'sedan'], ['Mazda', '3', 'sedan'], ['Mazda', 'Mazda6', 'sedan'],
    ['Subaru', 'WRX', 'sedan'], ['BMW', '330i', 'sedan'], ['BMW', '3 Series', 'sedan'], ['BMW', 'M3', 'sedan'], ['Mercedes-Benz', 'C-Class', 'sedan'],
    ['Mercedes-Benz', 'E-Class', 'sedan'], ['Audi', 'A4', 'sedan'], ['Audi', 'A6', 'sedan'], ['Lexus', 'ES 350', 'sedan'], ['Lexus', 'IS 300', 'sedan'],
    ['Acura', 'TLX', 'sedan'], ['Genesis', 'G80', 'sedan'], ['Cadillac', 'CT5', 'sedan'], ['Chrysler', '300', 'sedan'], ['Volvo', 'S60', 'sedan'],
    ['Alfa Romeo', 'Giulia', 'sedan'], ['Volkswagen', 'Jetta', 'sedan'], ['Chevrolet', 'Malibu', 'sedan'],
    // Coupes, GTs, muscle, roadsters
    ['Toyota', 'GR86', 'coupe'], ['Toyota', '86', 'coupe'], ['Subaru', 'BRZ', 'coupe'], ['BMW', 'M4', 'coupe'], ['BMW', '4 Series', 'coupe'],
    ['Lexus', 'RC 350', 'coupe'], ['Nissan', '370Z', 'coupe'], ['Nissan', 'Z', 'coupe'], ['Infiniti', 'Q60', 'coupe'], ['Audi', 'A5', 'coupe'],
    ['Toyota', 'Supra', 'gt'], ['Toyota', 'GR Supra', 'gt'], ['Porsche', '911', 'gt'], ['Porsche', '718 Cayman', 'gt'], ['Chevrolet', 'Corvette', 'gt'],
    ['Nissan', 'GT-R', 'gt'], ['Acura', 'NSX', 'gt'], ['Audi', 'R8', 'gt'], ['Ferrari', 'Roma', 'gt'], ['McLaren', '720S', 'gt'],
    ['Aston Martin', 'Vantage', 'gt'], ['Mercedes-Benz', 'AMG GT', 'gt'],
    ['Ford', 'Mustang', 'muscle'], ['Ford', 'Mustang GT', 'muscle'], ['Chevrolet', 'Camaro', 'muscle'], ['Dodge', 'Challenger', 'muscle'],
    ['Dodge', 'Charger', 'muscle'], ['Pontiac', 'GTO', 'muscle'],
    ['Mazda', 'MX-5 Miata', 'roadster'], ['Mazda', 'Miata', 'roadster'], ['Mazda', 'MX-5 Grand Touring', 'roadster'], ['Porsche', 'Boxster', 'roadster'],
    ['BMW', 'Z4', 'roadster'], ['Honda', 'S2000', 'roadster'], ['Mercedes-Benz', 'SL 550', 'roadster'], ['Fiat', '124 Spider', 'roadster'],
    ['Unknownmake', 'Unknown', 'sedan'],
  ] as const)('%s %s draws as %s', (make, model, expected) => {
    expect(carVariant(make, model)).toBe(expected);
    expect(carVariant(make, model, 'Other')).toBe(expected);
  });

  it('accepts a full label as the model', () => {
    expect(carVariant(null, 'Tesla Model X')).toBe('crossover');
    expect(carVariant('Ford', 'Ford Mustang GT')).toBe('muscle');
  });
});

describe('body class refines a known model', () => {
  it.each([
    ['Honda', 'Civic', 'Hatchback/Liftback/Notchback', 'hatch'], ['Honda', 'Civic', 'Coupe', 'coupe'],
    ['Volkswagen', 'Golf', 'Wagon', 'wagon'], ['Chevrolet', 'Camaro', 'Convertible/Cabriolet', 'roadster'],
    ['Chevrolet', 'Camaro', 'Coupe', 'muscle'], ['Porsche', '911', 'Coupe', 'gt'], ['Ford', 'F-150', 'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)', 'truck'],
    ['Tesla', 'Model X', 'Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)', 'crossover'],
  ] as const)('%s %s + %s draws as %s', (make, model, body, expected) => expect(carVariant(make, model, body)).toBe(expected));
});

/** Every coordinate pair in an SVG path string, absolute commands only (enough for bounds checks). */
function bbox(svg: string, re: RegExp) {
  const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const m of svg.matchAll(re)) {
    const nums = m[1]!.match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      out.x0 = Math.min(out.x0, nums[i]!); out.x1 = Math.max(out.x1, nums[i]!);
      out.y0 = Math.min(out.y0, nums[i + 1]!); out.y1 = Math.max(out.y1, nums[i + 1]!);
    }
  }
  return out;
}

it.each(Object.keys(CAR_WHEELS) as CarVariant[])('%s renders two equal tires on the ground line, flat-filled', variant => {
  const svg: string = renderToStaticMarkup(createElement(CarDrawing, { variant }));
  const wheels = CAR_WHEELS[variant];
  expect(wheels).toHaveLength(2);
  expect(wheels[0].r).toBe(wheels[1].r);
  for (const { cx, cy, r } of wheels) {
    expect(Math.abs(cy + r - 330)).toBeLessThanOrEqual(2);
    expect(svg).toContain(`<circle cx="${cx}" cy="${cy}" r="${r}"`);
  }
  expect(svg).not.toMatch(/Gradient/);
});

it.each(['sedan', 'suv', 'truck', 'hatch', 'crossover', 'van', 'wagon', 'coupe'] as const)('%s glass sits inside the body outline', async variant => {
  const bodies = await import('@/views/components/carDrawingBodies');
  const car = bodies[variant];
  const shell = bbox(car.base.find((e) => e.fi === 'BODY')!.d!, /([MLQC][^MLQCAVHZ]*)/g);
  for (const pane of car.glass.filter((e) => e.fi === 'var(--glass)')) {
    const b = bbox(pane.d!, /([MLQC][^MLQCAVHZ]*)/g);
    expect(b.x0).toBeGreaterThanOrEqual(shell.x0);
    expect(b.x1).toBeLessThanOrEqual(shell.x1);
    expect(b.y0).toBeGreaterThanOrEqual(shell.y0);
    expect(b.y1).toBeLessThanOrEqual(shell.y1);
  }
});
