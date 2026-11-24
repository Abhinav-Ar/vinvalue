import { exactName, referenceCandidates, type ReferenceData } from '@/models/reference';
import { median, quantile } from '@/models/stats';
import { evaluateSurface, NotEnoughDataError } from './surface';
import type { LabeledSale } from './calibration';
import { joinMarketSamples, type DealerSample } from './marketCalibration';
import { correctionFamily, correctionFactor, type Corrections } from './biasCorrections';

export const ageBucket=(age:number)=>age<=5?'0-5':age<=10?'6-10':age<=20?'11-20':'21+';
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
type Observation={id:string;family:string;segment:string;age:string;miles:number;predicted:number;observed:number};
const families=(rs:Observation[])=>new Set(rs.map(r=>r.family)).size;
function errors(rs:Observation[],c:Corrections) {
  const es=rs.map(r=>100*Math.abs(r.predicted*correctionFactor(c,r.segment,r.family)/r.observed-1));
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

const residual=(r:Observation)=>Math.log(r.observed/r.predicted);
const group=(rs:Observation[],key:(r:Observation)=>string)=>{
  const out=new Map<string,Observation[]>();for(const r of rs){const k=key(r);const a=out.get(k)??[];a.push(r);out.set(k,a);}return out;
};
function bootstrap(values:number[],seed:number) {
  let state=seed||1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const medians=Array.from({length:300},()=>median(values.map(()=>values[Math.floor(random()*values.length)]!)));
  return [Math.exp(quantile(medians,.1)),Math.exp(quantile(medians,.9))] as [number,number];
}
function summary(rs:Observation[]) {
  const values=rs.map(residual),center=median(values),spread=Math.max(.03,1.4826*median(values.map(x=>Math.abs(x-center))));
  const ci=bootstrap(values,hash(rs[0]!.family));
  return {center,spread,variance:Math.PI/2*spread**2/rs.length,ci};
}
const clamp=(v:number,low:number,high:number)=>Math.max(low,Math.min(high,v));
const blank=(now:Date):Corrections=>({version:2,methodVersion:'2.3.1',fittedAt:now.toISOString(),dataWindow:{from:now.toISOString().slice(0,7)+'-01',to:now.toISOString().slice(0,10)},cells:[],families:[]});
/** Robust log residuals shrink family centers toward zero (factor 1.0).
 * Between-family variance determines shrinkage strength; pooled centers are diagnostics only. */
function fit(rs:Observation[],now:Date,legacy=false) {
  const out=blank(now);
  for(const [segment,rows] of group(rs,r=>r.segment)) {
    const gs=[...group(rows,r=>r.family)].map(([family,rs])=>({family,rs,...summary(rs)}));
    const weights=gs.map(g=>1/(g.variance+.01));const total=weights.reduce((a,b)=>a+b,0);
    const pooled=gs.reduce((a,g,i)=>a+g.center*weights[i]!,0)/total;
    const between=Math.max(.0025,gs.reduce((a,g,i)=>a+weights[i]!*((g.center-pooled)**2-g.variance),0)/total);
    const poolingVariance=1/total;
    const segmentShrink=.15**2/(.15**2+poolingVariance+between/gs.length);
    const target=pooled*segmentShrink;
    // Family-level uncertainty, conservative for small numbers of families.
    const se=Math.sqrt(poolingVariance+between/gs.length);
    const ci:[number,number]=[Math.exp(pooled-1.282*se),Math.exp(pooled+1.282*se)];
    out.cells.push({segment,n:rows.length,factor:clamp(Math.exp(target),.75,1.25),shrinkage:segmentShrink,ci,wideCap:false});
    for(const g of gs) {
      const shrinkage=between/(between+g.variance);
      const wideCap=g.rs.length>=100&&g.ci[0]>=Math.exp(g.center)*.9&&g.ci[1]<=Math.exp(g.center)*1.1;
      const factor=clamp(Math.exp((legacy?target:0)+shrinkage*(g.center-(legacy?target:0))),wideCap?.5:.75,wideCap?2:1.25);
      out.families.push({family:g.family,segment,n:g.rs.length,factor,shrinkage,ci:g.ci,wideCap});
    }
  }
  return out;
}
function metric(es:number[]) {return {n:es.length,median:es.length?median(es):null,p80:es.length?quantile(es,.8):null};}
const improved=(a:ReturnType<typeof metric>,b:ReturnType<typeof metric>)=>a.n>=5&&b.median!<a.median!&&b.p80!<=a.p80!;
export function fitBiasCorrections(samples:DealerSample[],sales:LabeledSale[],data:ReferenceData,previous:Corrections,now=new Date()) {
  const empty=blank(now),{from,to}=empty.dataWindow;
  const current=samples.filter(s=>{const d=new Date(s.fetchedAt).toISOString().slice(0,10);return d>=from&&d<=to;});
  const dealerFactor=estimateDealerFactor(current,sales,data),joined=joinMarketSamples(current,data,dealerFactor.factor);
  const skipped:Array<{id:string;reason:string}>=[],ids=new Set<string>();
  const obs:Observation[]=joined.rows.flatMap(r=>{
    if(ids.has(r.groupId))return [];ids.add(r.groupId);
    try{const s=evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data);return [{id:r.groupId,family:correctionFamily(s.msrpRow!),segment:s.segment,age:ageBucket(s.age),miles:r.miles,predicted:s.H,observed:r.soldPrice}];}
    catch(e){if(!(e instanceof NotEnoughDataError))throw e;skipped.push({id:r.id,reason:e.message});return [];}
  });
  const fs=group(obs,r=>r.family),seenFold=new Map<string,number>(),unseenFold=new Map<string,number>();
  for(const rows of fs.values()) [...rows].sort((a,b)=>hash(a.id)-hash(b.id)||a.id.localeCompare(b.id)).forEach((r,i)=>seenFold.set(r.id,i%5));
  // Greedy segment-stratified family folds, balancing listing counts within each segment.
  for(const rows of group(obs,r=>r.segment).values()) {
    const loads=[0,0,0,0,0];
    for(const [f,rs] of [...group(rows,r=>r.family)].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]))) {const fold=loads.indexOf(Math.min(...loads));unseenFold.set(f,fold);loads[fold]!+=rs.length;}
  }
  type Prediction={r:Observation;before:number;after:number};
  function crossValidate(unseen:boolean) {
    const predictions:Prediction[]=[];
    const foldOf=(r:Observation)=>unseen?unseenFold.get(r.family)!:seenFold.get(r.id)!;
    const folds=[];
    for(let fold=0;fold<5;fold++) {
      const train=obs.filter(r=>foldOf(r)!==fold),test=obs.filter(r=>foldOf(r)===fold),c=fit(train,now);
      folds.push({fold,train:train.length,test:test.length,trainFamilies:families(train),testFamilies:families(test)});
      for(const r of test.filter(r=>unseen||fs.get(r.family)!.length>=5))predictions.push({r,before:100*Math.abs(r.predicted/r.observed-1),after:100*Math.abs(r.predicted*correctionFactor(c,r.segment,r.family)/r.observed-1)});
    }
    return {predictions,folds};
  }
  // Reproduce the previous pooled fallback in the same family-held-out folds.
  const legacyUnseen:Array<{r:Observation;error:number}>=[];
  for(let fold=0;fold<5;fold++) {
    const c=fit(obs.filter(r=>unseenFold.get(r.family)!==fold),now,true);
    for(const r of obs.filter(r=>unseenFold.get(r.family)===fold)) {
      const factor=c.cells.find(c=>c.segment===r.segment)?.factor??1;
      legacyUnseen.push({r,error:100*Math.abs(r.predicted*factor/r.observed-1)});
    }
  }
  const legacyAccepted=new Set([...new Set(legacyUnseen.map(p=>p.r.segment))].filter(segment=>{
    const ps=legacyUnseen.filter(p=>p.r.segment===segment);
    return families(ps.map(p=>p.r))>=3&&improved(metric(ps.map(p=>100*Math.abs(p.r.predicted/p.r.observed-1))),metric(ps.map(p=>p.error)));
  }));
  const seen=crossValidate(false),unseen=crossValidate(true),candidate=fit(obs,now);
  const proposedFamilies=[...candidate.families];
  const metricsFor=(ps:Prediction[])=>({before:metric(ps.map(p=>p.before)),after:metric(ps.map(p=>p.after))});
  const decisions=candidate.families.map(c=>{
    const ps=seen.predictions.filter(p=>p.r.family===c.family),m=metricsFor(ps);
    return {family:c.family,segment:c.segment,n:c.n,accepted:improved(m.before,m.after),...m};
  });
  const segmentDecisions=candidate.cells.map(c=>{const m=metricsFor(unseen.predictions.filter(p=>p.r.segment===c.segment));return {segment:c.segment,accepted:new Set(obs.filter(r=>r.segment===c.segment).map(r=>r.family)).size>=3&&improved(m.before,m.after),...m};});
  candidate.families=candidate.families.filter(c=>decisions.find(d=>d.family===c.family)!.accepted);
  candidate.cells=[]; // Segment pooling is diagnostic only; never published or used as a prior.
  // CV guard choices reuse these folds: evaluation is out-of-fit, not an independent final test.
  const rawCV={seen:metricsFor(seen.predictions),unseen:metricsFor(unseen.predictions)};
  // Re-evaluate guarded fold candidates, including fallback for rejected family cells.
  function guarded(unseenMode:boolean, predictions:Prediction[]) {
    const guardedPredictions:Prediction[]=[];
    for(let fold=0;fold<5;fold++) {
      const foldOf=(r:Observation)=>unseenMode?unseenFold.get(r.family)!:seenFold.get(r.id)!;
      const c=fit(obs.filter(r=>foldOf(r)!==fold),now);
      c.families=c.families.filter(c=>candidate.families.some(x=>x.family===c.family));
      c.cells=c.cells.filter(c=>candidate.cells.some(x=>x.segment===c.segment));
      for(const p of predictions.filter(p=>foldOf(p.r)===fold))guardedPredictions.push({...p,after:100*Math.abs(p.r.predicted*correctionFactor(c,p.r.segment,p.r.family)/p.r.observed-1)});
    }
    return guardedPredictions;
  }
  const guardedSeen=guarded(false,seen.predictions),guardedUnseen=guarded(true,unseen.predictions);
  const overall=metricsFor(guardedSeen);
  const previousSeen=errors(guardedSeen.map(p=>p.r),previous);
  // Method migration retires the unsafe pooled prior; compare against neutral.
  // Within 2.3.1, preserve the existing prior-improvement publication guard.
  const accepted=improved(overall.before,overall.after)&&(previous.methodVersion!=='2.3.1'||improved(previousSeen,overall.after))&&candidate.families.length>0;
  const corrections=accepted?candidate:previous;
  const buckets=[...new Set(obs.flatMap(r=>['segment:'+r.segment,'age:'+r.age,'segment-age:'+r.segment+'/'+r.age]))].sort();
  const metrics=buckets.map(bucket=>{const ps=seen.predictions.filter(p=>bucket==='segment:'+p.r.segment||bucket==='age:'+p.r.age||bucket==='segment-age:'+p.r.segment+'/'+p.r.age);return {bucket,...metricsFor(ps)};});
  const mileage= [...fs].filter(([,rs])=>rs.length>=30).map(([family,rs])=>{
    const ordered=[...rs].sort((a,b)=>a.miles-b.miles),lo=ordered.slice(0,Math.floor(rs.length/3)),hi=ordered.slice(-Math.floor(rs.length/3));
    const deltaMiles=median(hi.map(r=>r.miles))-median(lo.map(r=>r.miles));
    const deltaLog=median(hi.map(residual))-median(lo.map(residual));
    const lowCI=bootstrap(lo.map(residual),hash(family)),highCI=bootstrap(hi.map(residual),hash(family)+1);
    return {family,n:rs.length,deltaMiles,logResidualPer10k:deltaMiles?deltaLog/deltaMiles*10000:0,clearSlope:deltaMiles>=20000&&Math.abs(deltaLog)>.1&&(highCI[0]>lowCI[1]||highCI[1]<lowCI[0]),note:'Diagnostic only: low/high mileage thirds; age and trim may confound. No mileage slope correction fitted.'};
  });
  return {corrections,report:{fittedAt:now.toISOString(),dataWindow:{from,to},accepted,reason:accepted?'Published CV-improving family corrections shrunk toward 1.0; unsupported families use 1.0.':'Previous snapshot retained: CV median/p80 guard failed or insufficient evidence.',matching:{received:current.length,totalStored:samples.length,matched:joined.matched,modeled:obs.length,skipped,rate:current.length?joined.matched/current.length:null},dealerFactor,counts:{observations:obs.length,families:fs.size},decisions,segmentDecisions,proposedFamilies,proposedCells:candidate.cells,unseenFallback:{neutral:metric(unseen.predictions.map(p=>p.before)),previousPooled:metric(legacyUnseen.map(p=>legacyAccepted.has(p.r.segment)?p.error:100*Math.abs(p.r.predicted/p.r.observed-1)))},rawCV,cv:{seen:{...metricsFor(guardedSeen),folds:seen.folds},unseen:{...metricsFor(guardedUnseen),folds:unseen.folds}},mileage,baseline:overall.before,before:overall.before,after:overall.after,metrics,flaggedSegments:metrics.filter(m=>m.bucket.startsWith('segment:')&&(m.after.median??0)>15).map(m=>m.bucket),limitations:['One month: no temporal validation.','Five folds balanced within canonical make/model/generation, deduplicated by listing hash.','Family holdout is stratified by segment and greedily balanced by sample count; indivisible large families cause imbalance.','CV also selects publication guards; no independent final test. Metrics describe guarded out-of-fit candidates; publication guards reuse CV. Families with fewer than five listings are excluded from seen metrics.','Dealer asks × configured private-equivalent factor are proxies, not transaction truth.']}};
}
export type AccuracyReport=ReturnType<typeof fitBiasCorrections>['report'];
export function accuracyMarkdown(report:AccuracyReport) {
  return '# Monthly model accuracy — method 2.3.1\n\n'+report.reason+'\n\n| Evaluation | n | Median before | Median after | p80 before | p80 after |\n|---|---:|---:|---:|---:|---:|\n'+Object.entries(report.cv).map(([name,m])=>`| ${name} | ${m.before.n} | ${m.before.median?.toFixed(2)} | ${m.after.median?.toFixed(2)} | ${m.before.p80?.toFixed(2)} | ${m.after.p80?.toFixed(2)} |`).join('\n')+'\n\nUnseen fallback comparison (same family-held-out folds): '+JSON.stringify(report.unseenFallback)+'\n\n'+report.limitations.map(s=>'- '+s).join('\n')+'\n';
}
