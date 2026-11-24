import { exactName, resolveReference, type ReferenceData } from '@/models/reference';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
import { marketSampling } from '@/models/config/marketSampling';
import { evaluateSurface } from './surface';
import { scoreSales, type LabeledSale } from './calibration';
export type DealerSample = { listingHash:string; make:string;model:string;year:number;trim:string|null;miles:number;price:number;fetchedAt:Date|string };
export function joinMarketSamples(samples:DealerSample[],data:ReferenceData,factor:number=marketSampling.dealerToPrivateFactor) {
  if(!(factor>0&&factor<=1)) throw Error('Dealer conversion factor must be in (0,1]');
  const rows:LabeledSale[]=[];let unmatched=0;
  for(const r of samples) {
    const anchor=resolveReference(data,r,r.trim).msrpRow;
    if(!anchor){unmatched++;continue;}
    if(!(r.price>0&&r.miles>=0)) continue;
    rows.push({id:`market:${r.listingHash}`,groupId:r.listingHash,source:'market_sample',soldOn:new Date(r.fetchedAt).toISOString().slice(0,10),soldPrice:r.price*factor,make:anchor.make,model:anchor.model,year:r.year,trim:anchor.trim,miles:r.miles});
  }
  return {rows,received:samples.length,matched:rows.length,unmatched,matchRate:samples.length?rows.length/samples.length:null,factor,factorBasis:'Configured 0.90 dealer asking to private-party equivalent; not fitted. Sensitivity required before adoption.'};
}
const family=(r:LabeledSale,data:ReferenceData)=>{const a=resolveReference(data,r,r.trim).msrpRow;return `${exactName(a?.make??r.make)}/${exactName(a?.model??r.model)}`;};
/** Freeze one 50/50 split across both fits; no family ever contributes to both sides. */
export function proposeWithMarket(rows:LabeledSale[],data:ReferenceData) {
  // WA has no trim. Preserve the existing calibration's explicit base-tier assumption;
  // never apply that assumption to dealer listings with unmatched trims.
  rows=rows.map(r=>{
    if(r.source!=='wa_record'||r.trim!==null) return r;
    const anchors=data.msrp.filter(a=>exactName(a.make)===exactName(r.make)&&[a.model,...a.modelAliases].some(m=>exactName(m)===exactName(r.model))&&r.year>=a.yearFrom&&r.year<=a.yearTo).sort((a,b)=>a.tier-b.tier||a.msrpUsd-b.msrpUsd);
    const a=anchors[0];return a?{...r,make:a.make,model:a.model,trim:a.trim}:r;
  });
  const fs=[...new Set(rows.map(r=>family(r,data)))].sort();
  // Stable FNV ordering avoids alphabetical make bias; even/odd gives 50/50 families.
  const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
  fs.sort((a,b)=>hash(a)-hash(b)||a.localeCompare(b));
  const trainFamilies=new Set(fs.filter((_,i)=>i%2===0));
  const train=rows.filter(r=>trainFamilies.has(family(r,data))),holdout=rows.filter(r=>!trainFamilies.has(family(r,data)));
  function fit(input:LabeledSale[]) {
    const cfg:ValuationConfig={...valuationConfig,segmentCalibration:{...valuationConfig.segmentCalibration}};
    const segments=[...new Set(input.map(r=>{try{return evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data).segment;}catch{return null;}}).filter((s):s is string=>s!==null))];
    for(const segment of segments) {
      const rs=input.filter(r=>{try{return evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data).segment===segment;}catch{return false;}});
      if(rs.length<valuationConfig.calibration.minTrainingRows) continue;
      // Equal source influence: numerous dealer asks cannot overwhelm recorded sales/reference anchors.
      const sourceCounts=Object.fromEntries([...new Set(rs.map(r=>r.source))].map(s=>[s,rs.filter(r=>r.source===s).length]));
      const prior=valuationConfig.segmentCalibration[segment]??{market:1,k:1,floor:1,interval:.4};
      let best=Infinity,market=prior.market;
      for(let i=70;i<=180;i+=2) {
        const candidate={...cfg,segmentCalibration:{...cfg.segmentCalibration,[segment]:{...prior,market:prior.market*i/100}}};
        let loss=0;
        for(const r of rs) {const h=evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data,candidate).H;loss+=Math.abs(Math.log(h/r.soldPrice))/sourceCounts[r.source]!;}
        if(loss<best){best=loss;market=prior.market*i/100;}
      }
      cfg.segmentCalibration[segment]={...prior,market};
    }
    return cfg;
  }
  const before=fit(train.filter(r=>r.source!=='market_sample')),after=fit(train);
  const metrics=(cfg:ValuationConfig)=>({all:scoreSales(holdout,data,cfg),transactionsAndReferences:scoreSales(holdout.filter(r=>r.source!=='market_sample'),data,cfg),dealerAsks:scoreSales(holdout.filter(r=>r.source==='market_sample'),data,cfg)});
  const evOverlap=rows.filter(r=>r.source==='market_sample').flatMap(r=>{
    if(evaluateSurface(r,r.trim,r.miles,new Date(r.soldOn),data).segment!=='ev') return [];
    const matches=rows.filter(w=>w.source==='wa_record'&&family(w,data)===family(r,data)&&w.year===r.year&&Math.abs(w.miles-r.miles)<=10000&&Math.abs(Date.parse(w.soldOn)-Date.parse(r.soldOn))<=183*86400000);
    if(!matches.length)return [];
    return [{family:family(r,data),year:r.year,n:matches.length,recordedToAsk:matches.reduce((s,w)=>s+w.soldPrice,0)/matches.length/(r.soldPrice/marketSampling.dealerToPrivateFactor)}];
  });
  return {split:Object.fromEntries(fs.map(f=>[f,trainFamilies.has(f)?'train':'holdout'])),counts:{train:train.length,holdout:holdout.length,trainFamilies:trainFamilies.size,holdoutFamilies:fs.length-trainFamilies.size},baseline:metrics(valuationConfig),beforeAddingSamples:metrics(before),afterAddingSamples:metrics(after),proposedSegmentCalibration:after.segmentCalibration,evFactorSanity:{configuredFactor:marketSampling.dealerToPrivateFactor,overlap:evOverlap,note:evOverlap.length?'Observational comparison only: ask/sale date, condition and trim may differ.':'No comparable WA EV/dealer cells; factor cannot be validated.'},limitations:['WA records lack trims and assume the lowest MSRP tier; interpret their errors and EV overlap accordingly.','Dealer asks are not sales. Conversion is a configured assumption.','Only market multipliers are proposed; no automatic config changes.','50/50 family holdout shared by both fits; metrics include segment/age cells.','Sparse segments retain priors; source weighting equalizes source influence.']};
}
