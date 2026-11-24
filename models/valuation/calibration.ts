import { evaluateSurface, NotEnoughDataError } from './surface';
import { resolveReference, exactName, referenceCandidates, type ReferenceData } from '@/models/reference';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
export type LabeledSale = { id:string; groupId:string; source:'sale_outcome'|'wa_record'|'reference'|'market_sample'; soldOn:string; soldPrice:number; year:number; make:string; model:string; trim:string|null; miles:number; transmission?:string|null };
export function scoreSales(rows:LabeledSale[], data:ReferenceData, config:ValuationConfig=valuationConfig) {
  const scores:Array<{id:string;segment:string;ageBucket:string;ape:number;signed:number}> = [], skips:Array<{id:string;reason:string}> = [];
  for (const r of rows) {
    try {
      if (!(r.soldPrice>0)) throw new NotEnoughDataError('invalid sale price');
      const anchors=referenceCandidates(data,r.make,r.model).filter(m=>exactName(m.make)===exactName(r.make)&&exactName(m.model)===exactName(r.model)&&r.year>=m.yearFrom&&r.year<=m.yearTo);
      const unambiguousTrim=anchors.length===1 ? anchors[0]!.trim : null;
      const s=evaluateSurface(r,r.trim ?? unambiguousTrim,r.miles,new Date(r.soldOn),data,config);
      scores.push({id:r.id,segment:s.segment,ageBucket:s.age<=5?'0-5':s.age<=10?'6-10':s.age<=20?'11-20':'21+',ape:Math.abs(s.H/r.soldPrice-1)*100,signed:(s.H/r.soldPrice-1)*100});
    } catch(e) { if(e instanceof NotEnoughDataError) skips.push({id:r.id,reason:e.message}); else throw e; }
  }
  const groups=new Map<string,typeof scores>();
  for(const s of scores) {const key=`${s.segment}/${s.ageBucket}`; const group=groups.get(key)??[]; group.push(s); groups.set(key,group);}
  return {predicted:scores.length,skipped:skips,metrics:[...groups].map(([bucket,ss])=>({bucket,n:ss.length,MAPE:ss.reduce((a,s)=>a+s.ape,0)/ss.length,signedPct:ss.reduce((a,s)=>a+s.signed,0)/ss.length})),MAPE:scores.length?scores.reduce((a,s)=>a+s.ape,0)/scores.length:null};
}
/** Grouped temporal holdout: repeat vehicle observations never enter both partitions. */
export function calibrate(rows:LabeledSale[],data:ReferenceData) {
  const ordered=[...rows].sort((a,b)=>a.soldOn.localeCompare(b.soldOn));
  const cutoff=ordered[Math.floor(ordered.length*valuationConfig.calibration.trainingFraction)]?.soldOn ?? '';
  const later=new Set(ordered.filter(r=>r.soldOn>=cutoff).map(r=>r.groupId));
  const train=ordered.filter(r=>!later.has(r.groupId)),holdout=ordered.filter(r=>later.has(r.groupId));
  const segments=[...new Set(rows.map(r=>resolveReference(data,r,r.trim).generationRef?.segment).filter((s):s is NonNullable<typeof s>=>!!s))];
  return segments.map(segment=>{
    const select=(rr:LabeledSale[])=>rr.filter(r=>resolveReference(data,r,r.trim).generationRef?.segment===segment);
    const tr=select(train),ho=select(holdout);
    if(tr.length<valuationConfig.calibration.minTrainingRows) return {segment,status:'insufficient labeled training rows; retain priors',training:scoreSales(tr,data),holdout:scoreSales(ho,data)};
    let best=Infinity, proposed:{kMultiplier:number;floorMultiplier:number}|null=null;
    for(const kMultiplier of valuationConfig.calibration.kMultipliers) for(const floorMultiplier of valuationConfig.calibration.floorMultipliers) {
      const makes=[...new Set(tr.map(r=>r.make.toLowerCase()))];
      const cfg={...valuationConfig,retentionPriors:[...valuationConfig.retentionPriors.filter(r=>r.segment!==segment),...makes.map(make=>({make,segment,kMultiplier,floorMultiplier}))]};
      const s=scoreSales(tr,data,cfg);
      if(s.predicted>=valuationConfig.calibration.minTrainingRows && s.MAPE!=null && s.MAPE<best){best=s.MAPE;proposed={kMultiplier,floorMultiplier};}
    }
    const cfg=proposed?{...valuationConfig,retentionPriors:[...valuationConfig.retentionPriors.filter(r=>r.segment!==segment),...([...new Set(tr.map(r=>r.make.toLowerCase()))].map(make=>({make,segment,...proposed!})))]}:valuationConfig;
    return {segment,status:'proposal only; coarse constrained grid; age/period/cohort not separately identified',proposed,training:scoreSales(tr,data,cfg),holdout:scoreSales(ho,data,cfg)};
  });
}
