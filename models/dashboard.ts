import { count, desc, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { appraisals, vehicles } from './db/schema';
import { historyRows } from './history';
import type { DashboardData, ExtensionGarage } from '@/shared/collection';

export async function getDashboard(db: Db, userId: string): Promise<DashboardData> {
  const [rows, counts] = await Promise.all([historyRows(db, userId), db.select({ count: count() }).from(appraisals).where(eq(appraisals.userId, userId))]);
  const garage = rows.filter(i => i.vehicleId !== null);
  const totals = { vehicles: garage.length, appraisals: counts[0]?.count ?? 0, valuedVehicles: 0, privateValue: 0, instantValue: 0, retailValue: 0 };
  for (const i of garage) if (i.values) {
    totals.valuedVehicles++; totals.privateValue += i.values.private; totals.instantValue += i.values.instant; totals.retailValue += i.values.retail;
  }
  return { vehicles: garage, activity: rows.filter(i => i.source === 'appraisal').slice(0, 10), totals };
}

/** Versioned extension snapshot, joined by owned VIN; no browser-supplied answers. */
export async function getExtensionGarage(db: Db, userId: string): Promise<ExtensionGarage> {
  const [garage, snapshots] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.userId, userId)).limit(200),
    db.selectDistinctOn([sql`upper(trim(${appraisals.inputs}->>'vin'))`]).from(appraisals).where(eq(appraisals.userId, userId)).orderBy(sql`upper(trim(${appraisals.inputs}->>'vin'))`, desc(appraisals.createdAt), desc(appraisals.id)),
  ]);
  snapshots.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
  return { version: 1, accountId: userId, cars: garage.map(v => {
    const a = snapshots.find(a => a.inputs.vin.toUpperCase() === v.vin.toUpperCase());
    const i = a?.inputs;
    const mapped = (value: string | null | undefined, choices: Record<string, string>) => value ? choices[value] ?? null : null;
    return { id: v.id, vin: v.vin.toUpperCase(), year: v.specs.year, make: v.specs.make, model: v.specs.model, trim: v.trim,
      mileage: v.odometer, zip: v.zip, condition: i ? ({ excellent: 'Excellent', good: 'Good', fair: 'Fair', rough: 'Poor' }[i.condition] ?? null) : null,
      trade_in: a?.instantValue.value ?? null, body_class: v.specs.body, drive_type: v.specs.drive, fuel_type: v.specs.fuel,
      transmission: (v.specs as typeof v.specs & { transmission?: string }).transmission ?? null,
      cylinders: (v.specs as typeof v.specs & { cylinders?: number }).cylinders ?? null,
      answers: { accidents: i ? ({none: 'No', minor: 'Yes - minor', major: 'Yes - major'}[i.accidents] ?? null) : null,
        warningLights: i?.warningLights ? ({none: 'None', check_engine: 'Check Engine', other: 'Other'}[i.warningLights] ?? null) : null,
        titleStatus: i ? ({clean: 'Clean', rebuilt: 'Rebuilt', salvage: 'Salvage'}[i.title] ?? null) : null,
        keysCount: i?.keys === 'two' ? 'Both sets' : i?.keys === 'one' ? 'One set' : null,
        owners: i?.owners ?? null, serviceHistory: i?.serviceHistory ?? null,
        bodyDamage: mapped(i?.bodyDamage, {none: 'None', minor: 'Minor', major: 'Severe'}),
        mechanicalIssues: mapped(i?.mechanicalIssues, {none: 'None', minor: 'Minor', major: 'Major'}),
        featuresWorking: mapped(i?.featureFailures, {none: 'Yes', some: 'Some issues', many: 'Major issues'}),
        tireCondition: mapped(i?.tires, {good: 'All good', replace: 'Multiple need replacement'}),
        glassCondition: mapped(i?.glass, {good: 'None'}),
        interiorCleanliness: mapped(i?.interior, {clean: 'Clean', worn: 'Light wear', dirty: 'Stains or damage'}),
        odors: mapped(i?.odors, {none: 'None', smoke: 'Smoke', pet: 'Pet'}),
        roofType: mapped(i?.roof, {standard: 'Standard', sunroof: 'Sunroof', panoramic: 'Moonroof'}) },
    };
  }) };
}
