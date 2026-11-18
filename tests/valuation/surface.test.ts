import { describe,it,expect } from 'vitest';
import { loadReferences, resolveReference } from '@/models/reference';
import { evaluateSurface, NotEnoughDataError } from '@/models/valuation/surface';
import { computeValuation } from '@/models/valuation';
import { valuationConfig as C } from '@/models/config/valuation';
import { exampleReference } from '../fixtures/reference/factory';
import type { DecodedSpecs } from '@/models/db/schema';
const now = new Date('2026-11-16Z');
const data = exampleReference();
const specs: DecodedSpecs = {year:2017,make:'Toyota',model:'Camry LE',body:null,drive:null,engine:null,fuel:null,doors:null,plant:null,trimRaw:'Base',trimCandidates:['Base'],checkDigitValid:true};
const inputs = {vin:'FIXTURE',trim:'Base',mileage:90000,zip:'98001',condition:'good' as const,title:'clean' as const,accidents:'none' as const,serviceHistory:null,owners:null,keys:null,warningLights:null};
describe('reference-backed model and differential contracts',()=>{
 it('resolves exact case-insensitive aliases and never substring matches',()=>{
   expect(resolveReference(data,specs,'EXACT ALIAS').msrpRow).not.toBeNull();
   expect(resolveReference(data,specs,'Bas').msrpRow).toBeNull();
   expect(loadReferences('/path/that/does/not/exist').msrp).toEqual([]);
 });
 it('raises a typed friendly error without a documented anchor',()=>expect(()=>computeValuation({specs,inputs,listings:[],references:{...data,msrp:[]},now})).toThrow(NotEnoughDataError));
 it('retains Camry value better and reports calibrated model ranges with no fake comps',()=>{
   const r=computeValuation({specs,inputs,listings:[],references:data,now});
   expect(r.private.value).toBeGreaterThan(13000); expect(r.private.value).toBeLessThan(15000);
   expect(r.stats.used).toBe(0); expect(r.stats.weightedMedian).toBe(0);
   expect(r.private.low/r.private.value).toBeGreaterThan(.75);
   expect(r.private.high/r.private.value).toBeLessThan(1.26);
 });
 it('does not double-count desirability or mileage for identical comps',()=>{
   const ls=Array.from({length:10},(_,i)=>({id:String(i),vin:null,inventoryType:'used',price:14000,miles:90000,distance:10,year:2017,make:specs.make,model:specs.model,trim:'Base',sellerType:'private' as const,daysOnMarket:0}));
   const r=computeValuation({specs,inputs,listings:ls,references:data,now});
   expect(r.mode).toBe('comps'); expect(r.private.value).toBe(14000);
   expect(r.adjustments.some(a=>a.key==='mileage')).toBe(false);
   expect(r.audit?.normalizations.every(a=>a.ratio===1)).toBe(true);
   const unknown=computeValuation({specs,inputs,listings:ls.map(l=>({...l,trim:null,inventoryType:'public_record'})),references:data,now});
   expect(unknown.comps.every(c=>c.trimMatch==='adjusted')).toBe(true);
 });
 it('is monotone in mileage and supports evidenced generation overrides while G=0 ignores them',()=>{
   const d=exampleReference(6),s={year:1995,make:'Toyota',model:'Supra Turbo',transmission:'manual'};
   const before=evaluateSurface(s,'Base',30000,now,d);
   const cfg={...C,generationCurvePriors:{'toyota/supra turbo/fixture':{onset:12,onsetRetention:.8,growthCap:4,growth:.04,sourceUrls:['https://example.com/evidence']}}};
   const after=evaluateSurface(s,'Base',30000,now,d,cfg);
   expect(after.H).toBeGreaterThan(before.H*2);
   expect(evaluateSurface(s,'Base',10000,now,d).H).toBeGreaterThan(before.H);
   d.generations[0]!.G=0;
   expect(evaluateSurface(s,'Base',30000,now,d,cfg).H).toBe(evaluateSurface(s,'Base',30000,now,d).H);
 });
});
