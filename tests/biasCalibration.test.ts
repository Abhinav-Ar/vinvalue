import { describe,it,expect } from 'vitest';
import { loadReferences, resolveReference } from '@/models/reference';
import { valuationConfig } from '@/models/config/valuation';
import { evaluateSurface } from '@/models/valuation/surface';
import { prepareMarketObservation,cachedMarketValue, type DealerSample } from '@/models/valuation/marketCalibration';
import { fitBiasCorrections,estimateDealerFactor } from '@/models/valuation/biasCalibration';
import { correctionSchema, correctionFactor, type Corrections } from '@/models/valuation/biasCorrections';
const data=loadReferences();
const empty:Corrections={version:2,methodVersion:'2.3.1',families:[],fittedAt:'2026-11-23',dataWindow:{from:'',to:''},cells:[]};
const now=new Date('2026-11-23');

describe('cached production surface',()=>{
  it('equals production exactly across every documented anchor, grid multiplier and aliases',()=>{
    let checked=0;
    for(const a of data.msrp) {
      const year=Math.min(2026,a.yearTo);if(year<a.yearFrom)continue;
      const r={id:'x',groupId:'x',source:'reference' as const,soldOn:'2026-11-23',soldPrice:10000,make:a.make,model:a.modelAliases[0]??a.model,trim:a.trimAliases[0]??a.trim,year,miles:81321,transmission:a.transmission==='any'?null:a.transmission};
      if(!resolveReference(data,r,r.trim).msrpRow)continue;
      const p=prepareMarketObservation(r,data);
      if(!p){expect(()=>evaluateSurface(r,r.trim,r.miles,now,data)).toThrow();continue;}
      for(const multiplier of [.7,1,1.8]) {
        const prior=valuationConfig.segmentCalibration[p.segment];
        const cfg={...valuationConfig,segmentCalibration:{...valuationConfig.segmentCalibration,[p.segment]:{...(prior??{k:1,floor:1,interval:.4}),market:multiplier}}};
        expect(cachedMarketValue(p,cfg)).toBe(evaluateSurface(r,r.trim,r.miles,now,data,cfg).H);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  });
});

function synthetic(ratio=1.2) {
  const seen=new Set<string>();const samples:DealerSample[]=[];
  for(const a of data.msrp) {
    const key=a.make+'/'+a.model;
    if(seen.has(key)||a.yearTo<2018||a.yearFrom>2018)continue;
    const r={...a,year:2018};
    if(!resolveReference(data,r,a.trim).msrpRow)continue;
    const s=evaluateSurface(r,a.trim,80000,now,data);
    if(s.segment!=='truck')continue;seen.add(key);
    for(let i=0;i<40;i++)samples.push({listingHash:key+i,make:a.make,model:a.model,trim:a.trim,year:2018,miles:80000,price:s.H*ratio/.9,fetchedAt:now});
  }
  return samples;
}
it('fits families, enforces sparse caps and evaluates balanced listing folds',()=>{
 const result=fitBiasCorrections(synthetic(2),[],data,empty,now);
 expect(result.report.accepted).toBe(true);
 expect(result.corrections.families.length).toBeGreaterThan(1);
 expect(result.corrections.families.every(c=>c.factor===1.25&&!c.wideCap)).toBe(true);
 expect(result.report.cv.seen.after.median!).toBeLessThan(result.report.cv.seen.before.median!);
 expect(new Set(result.report.cv.seen.folds.map(f=>f.test)).size).toBe(1);
 expect(correctionSchema.safeParse(result.corrections).success).toBe(true);
});
it('preserves previous corrections for empty months',()=>{
 const previous=fitBiasCorrections(synthetic(),[],data,empty,now).corrections;
 expect(fitBiasCorrections([],[],data,previous,now).corrections).toEqual(previous);
});
it('keeps .90 without supported contemporaneous WA overlap',()=>{
 const e=estimateDealerFactor(synthetic(),[],data);expect(e.supported).toBe(false);expect(e.factor).toBe(.9);expect(e.estimate).toBeNull();
});
it('rejects unsupported wide caps',()=>{
 const c={segment:'truck',n:40,factor:1.8,shrinkage:.8,ci:[1.7,1.9],wideCap:false};
 expect(correctionSchema.safeParse({...empty,cells:[c]}).success).toBe(false);
 expect(correctionSchema.safeParse({...empty,cells:[{...c,wideCap:true}]}).success).toBe(false);
 expect(correctionSchema.safeParse({...empty,cells:[{...c,n:100,wideCap:true}]}).success).toBe(true);
});
it('recovers opposing family biases within a segment and allows precise large-family caps',()=>{
 const samples=synthetic();const keys=[...new Set(samples.map(s=>s.make+'/'+s.model))];
 const expanded=samples.flatMap(s=>Array.from({length:3},(_,i)=>({...s,listingHash:s.listingHash+'-'+i,price:s.price/1.2*(keys.indexOf(s.make+'/'+s.model)%2?1.8:.6)})));
 const result=fitBiasCorrections(expanded,[],data,empty,now);
 expect(result.corrections.families.some(c=>c.factor>1.25&&c.wideCap)).toBe(true);
 expect(result.corrections.families.some(c=>c.factor<.75&&c.wideCap)).toBe(true);
 expect(result.report.cv.seen.after.median!).toBeLessThan(result.report.cv.seen.before.median!);
 const duplicate=fitBiasCorrections([...expanded,...expanded],[],data,empty,now);
 expect(duplicate.report.counts).toEqual(result.report.counts);
});

it('uses neutral fallback even when a segment correction exists',()=>{
 const c={...empty,cells:[{segment:'suv',n:100,factor:.75,shrinkage:1,ci:[.7,.8] as [number,number],wideCap:false}]};
 expect(correctionFactor(c,'suv','toyota/rav4/unsupported')).toBe(1);
 const report=fitBiasCorrections(synthetic(),[],data,empty,now).report;
 expect(report.cv.unseen.after).toEqual(report.cv.unseen.before);
});

it('migrates legacy pooled snapshots to neutral-prior family corrections',()=>{
 const prior={...empty,methodVersion:'2.3.0' as const};
 const result=fitBiasCorrections(synthetic(),[],data,prior,now);
 expect(result.report.accepted).toBe(true);
 expect(result.corrections.methodVersion).toBe('2.3.1');
 expect(result.corrections.cells).toEqual([]);
});
