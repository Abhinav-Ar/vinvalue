import { exactName, referenceCandidates, type ReferenceData } from '@/models/reference';
import { median, quantile } from '@/models/stats';
import { evaluateSurface, NotEnoughDataError } from './surface';
import type { LabeledSale } from './calibration';
import { joinMarketSamples, type DealerSample } from './marketCalibration';
import { correctionFactor, type Corrections } from './biasCorrections';

export const ageBucket=(age:number)=>age<=5?'0-5':age<=10?'6-10':age<=20?'11-20':'21+';
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
type Observation={family:string;segment:string;age:string;predicted:number;observed:number};
const families=(rs:Observation[])=>new Set(rs.map(r=>r.family)).size;
function errors(rs:Observation[],c:Corrections) {
  const es=rs.map(r=>100*Math.abs(r.predicted*correctionFactor(c,r.segment)/r.observed-1));
  return {n:es.length,families:families(rs),median:es.length?median(es):null,p80:es.length?quantile(es,.8):null};
}

/** WA is deliberately aggregated into make/model/year/10k-mile/month cells.
 * Its missing trim, geography and transaction taxes preclude treating it as dealer truth. */
export function estimateDealerFactor(samples:DealerSample[],sales:LabeledSale[],data:ReferenceData) {
  const key=(make:string,model:string,year:number,miles:number,date:string)=>[exactName(make),exactName(model),year,Math.floor(miles/10000),date.slice(0,7)].join('/');
  const wa=new Map<string,number[]>(),asks=new Map<string,number[]>(),familyByKey=new Map<string,string>();
  for(const r of sales) if(r.source==='wa_record'&&r.soldPrice>0) {
    const anchor=referenceCandidates(data,r.make,r.model).find(a=>r.year>=a.yearFrom&&r.year<=a.yearTo);
    if(!anchor)continue;
    const k=key(anchor.make,anchor.model,r.year,r.miles,r.soldOn);
    const list=wa.get(k)??[];list.push(r.soldPrice);wa.set(k,list);
  }
  for(const s of samples) {
    const joined=joinMarketSamples([s],data,1).rows[0];if(!joined)continue;
    let surface;try{surface=evaluateSurface(joined,joined.trim,joined.miles,new Date(joined.soldOn),data);}catch(e){if(e instanceof NotEnoughDataError)continue;throw e;}
    if(surface.segment!=='ev')continue;
    const k=key(joined.make,joined.model,joined.year,joined.miles,joined.soldOn);
    const list=asks.get(k)??[];list.push(s.price);asks.set(k,list);
    familyByKey.set(k,exactName(joined.make)+'/'+exactName(joined.model));
  }
  const overlap=[...asks].flatMap(([k,as])=>{
    const ws=wa.get(k);return ws&&ws.length>=5&&as.length>=5?[{key:k,family:familyByKey.get(k)!,sales:ws.length,asks:as.length,ratio:median(ws)/median(as)}]:[];
  });
  const familyRatios=[...new Set(overlap.map(x=>x.family))].map(f=>median(overlap.filter(x=>x.family===f).map(x=>x.ratio)));
  // Distribution-free family-level interval. No listing-level pseudo-replication.
  const estimate=familyRatios.length?median(familyRatios):null;
  const interval=familyRatios.length>=5?[Math.min(...familyRatios),Math.max(...familyRatios)]:null;
  const supported=overlap.length>=10&&familyRatios.length>=5&&!!interval&&interval[1]!-interval[0]!<=.1&&estimate!>=.75&&estimate!<=1;
  return {factor:supported?estimate!:.9,estimate,interval,intervalBasis:'Conservative range of family-level median ratios; not a causal ask-to-sale estimate.',supported,waCells:wa.size,overlap,note:supported?'Supported contemporaneous EV overlap.':'Retain configured 0.90: insufficient contemporaneous EV families/cells or excessive uncertainty. WA has unknown trim and covers one state.'};
}

export function fitBiasCorrections(samples:DealerSample[],sales:LabeledSale[],data:ReferenceData,previous:Corrections,now=new Date()) {
  // Monthly data window: do not silently mix old asks with the current market.
  const to=now.toISOString().slice(0,10), from=to.slice(0,7)+'-01';
  const current=samples.filter(s=>{const d=new Date(s.fetchedAt).toISOString().slice(0,10);return d>=from&&d<=to;});
  const dealerFactor=estimateDealerFactor(current,sales,data);
  const joined=joinMarketSamples(current,data,dealerFactor.factor);
  const skipped:Array<{id:string;reason:string}>=[];
  const obs:Observation[]=joined.rows.flatMap(r=>{
    try {
    const s=evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data);
    return [{family:exactName(s.msrpRow!.make)+'/'+exactName(s.msrpRow!.model),segment:s.segment,age:ageBucket(s.age),predicted:s.H,observed:r.soldPrice}];
    }catch(e){if(!(e instanceof NotEnoughDataError))throw e;skipped.push({id:r.id,reason:e.message});return [];}
  });
  const fs=[...new Set(obs.map(r=>r.family))].sort((a,b)=>hash(a)-hash(b)||a.localeCompare(b));
  const training=new Set(fs.filter((_,i)=>i%2===0));
  const train=obs.filter(r=>training.has(r.family)), holdout=obs.filter(r=>!training.has(r.family));
  const proposed:Corrections={version:1,fittedAt:now.toISOString(),dataWindow:{from,to},cells:[]};
  const decisions:Array<{segment:string;reason:string;n:number;holdoutN:number;proposedFactor?:number;shrinkage?:number;before?:ReturnType<typeof errors>;after?:ReturnType<typeof errors>}>=[];
  for(const segment of [...new Set(obs.map(r=>r.segment))].sort()) {
    const tr=train.filter(r=>r.segment===segment),ho=holdout.filter(r=>r.segment===segment);
    const n=tr.length, shrinkage=n/(n+60);
    if(n<30||ho.length<30||families(tr)<2||families(ho)<2) {decisions.push({segment,n,holdoutN:ho.length,reason:'Retain previous: need >=30 observations and >=2 families in EACH partition.'});continue;}
    const factor=Math.max(.75,Math.min(1.25,Math.exp(median(tr.map(r=>Math.log(r.observed/r.predicted)))*shrinkage)));
    const before=errors(ho,previous);
    const candidate:Corrections={...proposed,cells:[{segment,n,families:families(tr),factor,shrinkage,holdout:{n:ho.length,families:families(ho),before:before.median!,after:0,p80Before:before.p80!,p80After:0}}]};
    const after=errors(ho,candidate);
    if(after.median!>before.median!||after.p80!>before.p80!) {decisions.push({segment,n,holdoutN:ho.length,proposedFactor:factor,shrinkage,before,after,reason:'Retain previous: holdout median or p80 worsened.'});continue;}
    candidate.cells[0]!.holdout.after=after.median!;candidate.cells[0]!.holdout.p80After=after.p80!;
    proposed.cells.push(candidate.cells[0]!);decisions.push({segment,n,holdoutN:ho.length,proposedFactor:factor,shrinkage,before,after,reason:'Accepted: sample, family, cap and holdout guards pass.'});
  }
  const next:Corrections={...proposed,cells:[...previous.cells.filter(c=>!proposed.cells.some(x=>x.segment===c.segment)),...proposed.cells]};
  const overallBefore=errors(holdout,previous),overallAfter=errors(holdout,next);
  const accepted=holdout.length>=30&&overallAfter.median!<=overallBefore.median!&&overallAfter.p80!<=overallBefore.p80!;
  const corrections=accepted?next:previous;
  const empty:Corrections={...proposed,cells:[]};
  const buckets=[...new Set(obs.flatMap(r=>['segment:'+r.segment,'age:'+r.age,'segment-age:'+r.segment+'/'+r.age]))].sort();
  const metrics=buckets.map(bucket=>{
    const rs=holdout.filter(r=>bucket==='segment:'+r.segment||bucket==='age:'+r.age||bucket==='segment-age:'+r.segment+'/'+r.age);
    return {bucket,before:errors(rs,empty),after:errors(rs,corrections)};
  });
  return {corrections,report:{fittedAt:now.toISOString(),dataWindow:{from,to},accepted,reason:accepted?'Non-worsening overall holdout median and p80.':'Previous snapshot retained: insufficient holdout or overall error worsened.',matching:{received:current.length,totalStored:samples.length,matched:joined.matched,modeled:obs.length,skipped,rate:current.length?joined.matched/current.length:null},dealerFactor,split:Object.fromEntries(fs.map(f=>[f,training.has(f)?'train':'holdout'])),counts:{train:train.length,holdout:holdout.length,trainFamilies:training.size,holdoutFamilies:fs.length-training.size},decisions,proposedCells:proposed.cells,baseline:errors(holdout,empty),before:overallBefore,after:errors(holdout,corrections),metrics,flaggedSegments:metrics.filter(m=>m.bucket.startsWith('segment:')&&(m.after.median??0)>15).map(m=>m.bucket)}};
}
export type AccuracyReport=ReturnType<typeof fitBiasCorrections>['report'];
export function accuracyMarkdown(report:AccuracyReport) {
  return '# Monthly model accuracy\n\n'+report.reason+'\n\nErrors are percentages against dealer asks converted to private equivalents; family-separated holdout. WA records only inform aggregated EV overlap.\n\n| Bucket | n | Median before | Median after | p80 after |\n|---|---:|---:|---:|---:|\n'+report.metrics.map(m=>'| '+[m.bucket,m.after.n,m.before.median?.toFixed(2),m.after.median?.toFixed(2),m.after.p80?.toFixed(2)].join(' | ')+' |').join('\n')+'\n\nFlagged (>15% median): '+report.flaggedSegments.join(', ')+'\n';
}
