import { describe,it,expect } from 'vitest';
import { loadReferences, resolveReference } from '@/models/reference';
import { valuationConfig } from '@/models/config/valuation';
import { evaluateSurface } from '@/models/valuation/surface';
import { prepareMarketObservation,cachedMarketValue, type DealerSample } from '@/models/valuation/marketCalibration';
import { fitBiasCorrections,estimateDealerFactor } from '@/models/valuation/biasCalibration';
import { correctionSchema, type Corrections } from '@/models/valuation/biasCorrections';
const data=loadReferences();
const empty:Corrections={version:1,fittedAt:'2026-11-23',dataWindow:{from:'',to:''},cells:[]};
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
it('shrinks, caps and accepts only non-worsening family holdout corrections',()=>{
 const result=fitBiasCorrections(synthetic(2),[],data,empty,now);
 expect(result.report.accepted).toBe(true);
 const c=result.corrections.cells.find(c=>c.segment==='truck')!;
 expect(c.n).toBeGreaterThanOrEqual(30);expect(c.factor).toBe(1.25);
 expect(c.shrinkage).toBeLessThan(1);
 expect(c.holdout.after).toBeLessThan(c.holdout.before);
 expect(result.report.counts.trainFamilies).toBeGreaterThan(1);
 expect(correctionSchema.safeParse(result.corrections).success).toBe(true);
});
it('preserves previous corrections for sparse and empty months',()=>{
 const previous=fitBiasCorrections(synthetic(),[],data,empty,now).corrections;
 expect(fitBiasCorrections([],[],data,previous,now).corrections).toEqual(previous);
 const oneFamily=synthetic().filter(r=>r.make==='Ford').slice(0,40);
 expect(fitBiasCorrections(oneFamily,[],data,empty,now).corrections.cells).toEqual([]);
});
it('keeps .90 without supported contemporaneous WA overlap',()=>{
 const e=estimateDealerFactor(synthetic(),[],data);expect(e.supported).toBe(false);expect(e.factor).toBe(.9);expect(e.estimate).toBeNull();
});
it('rejects a correction when held-out families disagree with training',()=>{
 const samples=synthetic(2);
 const first=fitBiasCorrections(samples,[],data,empty,now);
 const shifted=samples.map(s=>first.report.split[(s.make+'/'+s.model).toLowerCase()]==='holdout'?{...s,price:s.price/2}:s);
 const result=fitBiasCorrections(shifted,[],data,empty,now);
 expect(result.corrections.cells).toEqual([]);
 expect(result.report.decisions.some(d=>d.reason.includes('worsened'))).toBe(true);
});
it('does not allow invalid correction factors',()=>{
 expect(correctionSchema.safeParse({...empty,cells:[{segment:'truck',n:500,families:5,factor:1.3,shrinkage:.8,holdout:{n:50,families:2,before:20,after:10,p80Before:25,p80After:15}}]}).success).toBe(false);
});
