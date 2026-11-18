/** Offline adapter: callers inject a local database; no connection or writes here. */
import { eq } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { saleOutcomes, appraisals, publicRecordSales } from '@/models/db/schema';
import type { LabeledSale } from '@/models/valuation/calibration';
export async function readCalibrationSales(db:Db):Promise<LabeledSale[]> {
  const outcomes=await db.select({outcome:saleOutcomes,appraisal:appraisals}).from(saleOutcomes).innerJoin(appraisals,eq(saleOutcomes.appraisalId,appraisals.id));
  // Ingest has no exported calibration reader yet. Read its normalized table only; never raw DMV rows.
  const records=await db.select().from(publicRecordSales);
  return [
    ...outcomes.filter(r=>r.outcome.route==='private').map(({outcome:o,appraisal:a})=>({id:o.id,groupId:o.vehicleId??o.appraisalId??o.id,source:'sale_outcome' as const,soldOn:o.soldOn,soldPrice:o.soldPrice,...a.specs,trim:a.inputs.trim,miles:a.inputs.mileage})),
    ...records.filter(r=>r.odometer!=null).map(r=>({id:r.rowHash,groupId:r.rowHash,source:'wa_record' as const,soldOn:r.transactionDate,soldPrice:r.salePrice,year:r.modelYear,make:r.make,model:r.model,trim:null,miles:r.odometer!})),
  ];
}
