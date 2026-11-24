import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { appraisals, saleOutcomes } from '@/models/db/schema';
// Explicit allowlist: never serialize whole database rows or free-text fields.
const columns = ['make', 'model', 'year', 'trim', 'miles', 'price', 'route', 'month'] as const;
function cell(value: unknown) {
  const s = String(value ?? '');
  // Prevent spreadsheet formula execution as well as CSV delimiter injection.
  return '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
}
export async function exportSaleOutcomes(db: Db): Promise<string> {
  const rows = await db.select({ outcome: saleOutcomes, appraisal: appraisals }).from(saleOutcomes)
    .leftJoin(appraisals, eq(saleOutcomes.appraisalId, appraisals.id));
  return columns.join(',') + '\n' + rows.flatMap(({ outcome: o, appraisal: a }) => {
    const s = o.snapshot ?? (a ? { ...a.specs, trim: a.inputs.trim, miles: a.inputs.mileage } : null);
    if (!s) return [];
    return [[s.make, s.model, s.year, s.trim, s.miles, o.soldPrice, o.route, o.soldOn.slice(0, 7)].map(cell).join(',') + '\n'];
  }).join('');
}
