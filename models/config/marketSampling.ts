import { valuationConfig } from '@/models/config/valuation';
import { exactName, type ReferenceData } from '@/models/reference';
export const marketSampling = {
  monthlyCalls: 450, maxCallsPerRun: 35, runMs: 45000, radius: 100,
  dealerToPrivateFactor: 0.90, // Configured assumption, not a transaction-derived estimate.
  zips: ['98101','90012','85001','80202','75201','60601','30303','10001'],
  weights: { truck: .30, suv: .25, performance: .20, luxury: .10, control: .15 },
  ageBuckets: [[1,4],[5,9],[10,15],[16,25]],
} as const;
export type SampleQuery = { make:string; model:string; yearFrom:number; yearTo:number; zip:string; radiusMiles:number; segment:string; trim?:string };
export function sampleSegment(make:string,model:string) {
  if (/f-?150|f-?250|f-?350|super duty|silverado|sierra|ram|tacoma|tundra|ranger|colorado|frontier/i.test(model)) return 'truck';
  if (/wrangler|bronco|4runner|tahoe|suburban|yukon|expedition|explorer|grand cherokee|land cruiser|sequoia/i.test(model)) return 'suv';
  if (/mustang|camaro|challenger|charger|corvette|wrx|golf|gti|civic|911|m3|m4/i.test(model)) return 'performance';
  if (/bmw|mercedes|audi|lexus/i.test(make)) return 'luxury';
  const segment=valuationConfig.familySegments[`${exactName(make)}/${exactName(model)}`];
  if(segment==='sports'||segment==='supercar') return 'performance';
  if(segment==='truck'||segment==='suv'||segment==='luxury') return segment;
  return ['economy','midsize','fullsize','van','ev'].includes(segment??'')?'control':'excluded';
}
/** Only anchored model-years, deterministic rotation through families, ages and eight metros. */
export function buildSamplingPlan(data:ReferenceData, month:string, budget:number=marketSampling.monthlyCalls):SampleQuery[] {
  const rotation=Number(month.slice(0,4))*12+Number(month.slice(5)), year=Number(month.slice(0,4));
  const families=[...new Map(data.msrp.map(r=>[`${exactName(r.make)}/${exactName(r.model)}`,{make:r.make,model:r.model}])).values()].sort((a,b)=>`${a.make}/${a.model}`.localeCompare(`${b.make}/${b.model}`));
  const pools=Object.fromEntries(Object.keys(marketSampling.weights).map(s=>[s,families.filter(f=>sampleSegment(f.make,f.model)===s).flatMap(f=>marketSampling.ageBuckets.flatMap(([lo,hi])=>{
    const years=Array.from({length:hi-lo+1},(_,i)=>year-hi+i).filter(y=>data.msrp.some(r=>r.make===f.make&&r.model===f.model&&y>=r.yearFrom&&y<=r.yearTo));
    // One anchored year per request avoids gaps in generation coverage.
    return years.flatMap(y=>{
      if(/^(civic|golf|gti)$/i.test(f.model)) {
        const trims=data.msrp.filter(r=>r.make===f.make&&r.model===f.model&&y>=r.yearFrom&&y<=r.yearTo&&/^(si|type r|gti|golf r|r)$/i.test(r.trim));
        return trims.map(r=>({...f,yearFrom:y,yearTo:y,segment:s,trim:r.trim}));
      }
      return [{...f,yearFrom:y,yearTo:y,segment:s}];
    });
  }))]));
  const plan:SampleQuery[]=[];const counts:Record<string,number>={};
  for(let i=0;i<budget;i++) {
    const segment=Object.keys(marketSampling.weights).filter(s=>pools[s]!.length).sort((a,b)=>(counts[a]??0)/marketSampling.weights[a as keyof typeof marketSampling.weights]-(counts[b]??0)/marketSampling.weights[b as keyof typeof marketSampling.weights])[0];
    if(!segment) break;
    const n=counts[segment]??0,pool=pools[segment]!;counts[segment]=n+1;
    plan.push({...pool[(rotation*37+n)%pool.length]!,zip:marketSampling.zips[(rotation+i)%marketSampling.zips.length]!,radiusMiles:100});
  }
  return plan;
}
