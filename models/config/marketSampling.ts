import registrationRanking from './registrationRanking.json';
import marketcheckNames from './marketcheckNames.json';
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
/** Snapshot generated from scripts/reference/ranked-models.csv; aliases resolve to MSRP families.
 * SILVERADO/SIERRA registrations belong to 1500; unsplit DODGE RAM belongs to Ram 1500.
 * No volume is invented for heavy-duty variants or unsupported registration names. */
export function rankedSamplingFamilies(data:ReferenceData) {
  return registrationRanking.filter(f=>data.msrp.some(r=>r.make===f.make&&r.model===f.model)&&
    (data.msrp.some(r=>r.make===f.make&&r.model===f.model&&r.yearTo>=2005)||
     data.generations.some(g=>g.make===f.make&&g.model===f.model&&g.E>=.6)));
}
export function marketcheckName(make:string,model:string) {
  const name=(marketcheckNames as Record<string,{make:string;model:string}>)[`${exactName(make)}/${exactName(model)}`];
  if(!name) throw new Error('Missing explicit MarketCheck family name');
  return name;
}
/** Reserve 85% for the top 60, guaranteeing every family before weighted extra calls.
 * Long tail rotates by family, rather than by model-year, so old families cannot monopolize it. */
export function buildSamplingPlan(data:ReferenceData, month:string, budget:number=marketSampling.monthlyCalls):SampleQuery[] {
  const rotation=Number(month.slice(0,4))*12+Number(month.slice(5)),year=Number(month.slice(0,4));
  const ranked=rankedSamplingFamilies(data);
  const candidates=ranked.map(f=>{
    const rows=data.msrp.filter(r=>r.make===f.make&&r.model===f.model);
    const cells=rows.flatMap(r=>marketSampling.ageBuckets.flatMap(([lo,hi],bucket)=>{
      const from=Math.max(r.yearFrom,year-hi),to=Math.min(r.yearTo,year-lo);
      return from<=to?[{generation:r.generation,bucket,from,to}]:[];
    }));
    const unique=[...new Map(cells.map(c=>[`${c.generation}/${c.bucket}`,c])).values()];
    // Collector generations older than the ordinary age window remain eligible.
    if(!unique.length) for(const g of data.generations.filter(g=>g.make===f.make&&g.model===f.model&&g.E>=.6)) {
      const r=rows.find(r=>r.generation===g.generation);if(r)unique.push({generation:g.generation,bucket:4,from:r.yearFrom,to:Math.min(r.yearTo,year-1)});
    }
    return {...f,cells:unique,segment:sampleSegment(f.make,f.model)};
  }).filter(f=>f.cells.length);
  const top=candidates.slice(0,60),tail=candidates.slice(60),counts=new Map<string,number>(),plan:SampleQuery[]=[];
  const add=(f:typeof candidates[number])=>{
    const key=f.make+'/'+f.model,n=counts.get(key)??0;counts.set(key,n+1);
    const cell=f.cells[(rotation+n)%f.cells.length]!,y=cell.from+(rotation+n)% (cell.to-cell.from+1);
    plan.push({make:f.make,model:f.model,yearFrom:y,yearTo:y,segment:f.segment,
      zip:marketSampling.zips[(rotation+candidates.indexOf(f)+n)%8]!,radiusMiles:100});
  };
  const total=Math.max(0,Math.floor(budget)),tailCalls=tail.length?Math.floor(total*.15):0,headCalls=total-tailCalls;
  for(const f of top.slice(0,headCalls))add(f);
  const weight=(f:typeof candidates[number])=>Math.sqrt(f.registrations||1)*
    (marketSampling.weights[f.segment as keyof typeof marketSampling.weights]??.15);
  while(plan.length<headCalls&&top.length) {
    add([...top].sort((a,b)=>(counts.get(a.make+'/'+a.model)??0)/weight(a)-(counts.get(b.make+'/'+b.model)??0)/weight(b))[0]!);
  }
  for(let i=0;i<tailCalls;i++)add(tail[(rotation*tailCalls+i)%tail.length]!);
  return plan;
}
