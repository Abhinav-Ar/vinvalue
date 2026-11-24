/** No providers, file writes or network calls: safe for the monthly Vercel cron. */
import { eq, lt, desc } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { valuationCorrections, valuationAccuracyReports, marketSamples } from '@/models/db/schema';
import { readCalibrationSales } from '@/models/appraisals/calibrationData';
import { loadReferences } from '@/models/reference';
import { committedCorrections, correctionSchema } from '@/models/valuation/biasCorrections';
import { fitBiasCorrections, accuracyMarkdown } from '@/models/valuation/biasCalibration';

export async function readCorrections(db:Db) {
  try {
    const [row]=await db.select().from(valuationCorrections).where(eq(valuationCorrections.id,'active'));
    const parsed=correctionSchema.safeParse(row?.snapshot);
    return parsed.success?parsed.data:committedCorrections;
  } catch(e) {
    // Rolling deployments may precede migration. Other DB errors must remain visible.
    const error=e as {code?:string;cause?:{code?:string}};
    if(error.code==='42P01'||error.cause?.code==='42P01')return committedCorrections;
    throw e;
  }
}
export async function runValuationCalibration(db:Db,now=new Date(),force=false) {
  const month=now.toISOString().slice(0,7);
  // Lock the active row through fit + publication; concurrent invocations serialize.
  await db.insert(valuationCorrections).values({id:'active',snapshot:committedCorrections}).onConflictDoNothing();
  return db.transaction(async tx=>{
    const [active]=await tx.select().from(valuationCorrections).where(eq(valuationCorrections.id,'active')).for('update');
    const [done]=await tx.select().from(valuationAccuracyReports).where(eq(valuationAccuracyReports.month,month));
    if(done&&!force)return {corrections:active!.snapshot,report:done.report,markdown:done.markdown,drift:done.drift};
    const [samples,sales]=await Promise.all([tx.select().from(marketSamples),readCalibrationSales(tx)]);
    const parsed=correctionSchema.safeParse(active!.snapshot);
    const previous=parsed.success?parsed.data:committedCorrections;
    const result=fitBiasCorrections(samples,sales,loadReferences(),previous,now);
    const [last]=await tx.select().from(valuationAccuracyReports).where(lt(valuationAccuracyReports.month,month)).orderBy(desc(valuationAccuracyReports.month)).limit(1);
    const drift=result.report.metrics.map(m=>{
      const prior=last?.report.metrics.find(x=>x.bucket===m.bucket)?.after;
      return {bucket:m.bucket,medianDelta:prior?.median!=null&&m.after.median!=null?m.after.median-prior.median:null,p80Delta:prior?.p80!=null&&m.after.p80!=null?m.after.p80-prior.p80:null};
    });
    const markdown=accuracyMarkdown(result.report)+'\n## Drift versus previous month\n\n'+(last?JSON.stringify(drift,null,2):'No previous month: drift unavailable.')+'\n';
    if(result.report.accepted)await tx.update(valuationCorrections).set({snapshot:result.corrections,updatedAt:now}).where(eq(valuationCorrections.id,'active'));
    await tx.insert(valuationAccuracyReports).values({month,report:result.report,markdown,drift}).onConflictDoUpdate({target:valuationAccuracyReports.month,set:{report:result.report,markdown,drift}});
    return {...result,markdown,drift};
  });
}
