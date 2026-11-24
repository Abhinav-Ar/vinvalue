import { it,expect } from 'vitest';
import { createTestDb } from './helpers/db';
import { readCorrections,runValuationCalibration } from '@/models/jobs/valuationCalibration';
import { valuationCorrections,valuationAccuracyReports } from '@/models/db/schema';
import { committedCorrections } from '@/models/valuation/biasCorrections';
it('stores monthly JSON, Markdown, unavailable initial drift, and preserves corrections on empty data',async()=>{
 const db=await createTestDb();
 expect(await readCorrections(db)).toEqual(committedCorrections);
 const first=await runValuationCalibration(db,new Date('2026-11-23'));
 expect(first.report.accepted).toBe(false);
 expect(first.corrections).toEqual(committedCorrections);
 expect(first.markdown).toContain('No previous month');
 const repeat=await runValuationCalibration(db,new Date('2026-11-24'));
 expect(repeat.report).toEqual(first.report);
 expect(await db.select().from(valuationAccuracyReports)).toHaveLength(1);
 expect(await db.select().from(valuationCorrections)).toHaveLength(1);
 const second=await runValuationCalibration(db,new Date('2026-12-23'));
 expect(second.report.accepted).toBe(false);
 expect(await db.select().from(valuationAccuracyReports)).toHaveLength(2);
 expect(await readCorrections(db)).toEqual(committedCorrections);
});
it('uses a valid DB snapshot ahead of the committed fallback and ignores malformed snapshots',async()=>{
 const db=await createTestDb();
 const custom={...committedCorrections,fittedAt:'2026-12-01T00:00:00.000Z'};
 await db.insert(valuationCorrections).values({id:'active',snapshot:custom});
 expect((await readCorrections(db)).fittedAt).toBe(custom.fittedAt);
 await db.update(valuationCorrections).set({snapshot:{garbage:true} as never});
 expect(await readCorrections(db)).toEqual(committedCorrections);
});
