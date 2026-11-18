import type { ComputeArgs, TrimMatch } from './index';
import { evaluateSurface, NotEnoughDataError, type Surface } from './surface';
import { exactName, type ReferenceData } from '@/models/reference';
import type { ValuationConfig } from '@/models/config/valuation';
import type { Listing } from '@/models/providers/types';
import { quantile, weightedMedian } from '@/models/stats';
import type { ValuationAudit } from '@/shared/valuation';

export function normalizeSurfaceComps(args: ComputeArgs, subject: Surface, data: ReferenceData, now: Date, config: ValuationConfig) {
  const listings: Listing[] = [], weights = new Map<string,number>(), matches = new Map<string,TrimMatch>();
  const audit: ValuationAudit['normalizations'] = [];
  const p = config.surface;
  const pe = (l:Listing) => l.price*(l.inventoryType === 'public_record' || l.inventoryType === 'public_record_sale' || l.sellerType === 'private' ? 1 : 1+config.dealerToPrivatePct);
  const candidates = args.listings.flatMap(l => {
    if (['new','certified'].includes(l.inventoryType ?? '')) return [];
    // The provider currently maps missing odometers to zero: do not award a low-mile premium.
    if (l.inventoryType === 'public_record' && l.miles === 0) return [];
    const unknown = !l.trim;
    // No critical identity inference for collector/performance comps. Unknown ordinary trims
    // use an explicitly uncertain subject-trim scenario, never an exact match.
    if (unknown && subject.D > p.performanceThreshold) return [];
    try {
      const s = evaluateSurface({ year:l.year,make:l.make,model:l.model,transmission:null },l.trim ?? args.inputs.trim,l.miles,now,data,config);
      if (exactName(l.make)!==exactName(args.specs.make) || exactName(l.model)!==exactName(args.specs.model) || s.msrpRow!.generation !== subject.msrpRow!.generation || s.msrpRow!.body !== subject.msrpRow!.body) return [];
      const same = !unknown && s.msrpRow!.trim === subject.msrpRow!.trim;
      // Fixed schema contains no externally validated cross-performance differential flag.
      if (!same && !unknown && (s.D > p.performanceThreshold || subject.D > p.performanceThreshold)) return [];
      if (subject.variantRef?.manualPreferred && !l.trim?.toLowerCase().split(/\s+/).includes('manual')) return [];
      const d = Math.abs(l.miles-args.inputs.mileage)/(config.mileageWeightScale/(1+2*subject.D**2));
      let w = 1/(1+d*d)*config.otherYearWeight**Math.abs(l.year-args.specs.year)*Math.min(subject.q,s.q);
      if (l.daysOnMarket != null && l.daysOnMarket >= config.staleDomDays) w *= config.staleWeight;
      if (!same) w *= unknown ? p.unknownTrimWeight : config.trimAdjustedWeight;
      return [{ l,s,same,unknown,w,zWeight:s.q*(l.daysOnMarket != null && l.daysOnMarket>=config.staleDomDays ? config.staleWeight : 1),z:Math.log(pe(l))-Math.log(s.R)-s.L }];
    } catch(e) { if (e instanceof NotEnoughDataError) return []; throw e; }
  });
  const group = (trim:string) => candidates.filter(c=>!c.unknown && c.s.msrpRow!.trim===trim);
  const sg = group(subject.msrpRow!.trim);
  const effective = (g:typeof candidates) => { const w=g.reduce((a,c)=>a+c.zWeight,0); return w*w/g.reduce((a,c)=>a+c.zWeight*c.zWeight,0); };
  for (const c of candidates) {
    let residual = 0, lambda = 0;
    if (!c.same && !c.unknown && sg.length >= config.trimGapMinPerSide) {
      const cg = group(c.s.msrpRow!.trim);
      const pair = Math.min(effective(sg),effective(cg));
      if (pair >= config.trimGapMinPerSide) {
        const band = (g:typeof candidates) => [quantile(g.map(c=>c.l.miles),.1),quantile(g.map(c=>c.l.miles),.9)];
        const [sl,sh]=band(sg),[cl,ch]=band(cg);
        const overlap = Math.max(0,Math.min(sh!,ch!)-Math.max(sl!,cl!));
        const span = Math.min(sh!-sl!,ch!-cl!);
        if ((span===0 && sl===cl) || (span>0 && overlap/span>=p.overlapMin)) {
          lambda = Math.min(p.residualMaxLambda,Math.max(0,(pair-config.trimGapMinPerSide)/(pair+p.residualOffset)));
          residual = lambda*(weightedMedian(sg.map(x=>({value:x.z,weight:x.zWeight})))-weightedMedian(cg.map(x=>({value:x.z,weight:x.zWeight})))-Math.log(subject.M/c.s.M));
        }
      }
    }
    const ratio = subject.H/c.s.H*Math.exp(residual);
    const bound = subject.D > p.performanceThreshold || c.s.D > p.performanceThreshold ? p.performanceNormalizationCap : p.normalizationCap;
    if (Math.abs(Math.log(ratio))>Math.log(bound)) { audit.push({id:c.l.id,ratio,residual,lambda,reason:'excluded: normalization exceeds supported bound'}); continue; }
    // Private-equivalent normalized amounts passed as private to avoid a second seller conversion.
    listings.push({...c.l,price:pe(c.l)*ratio});
    weights.set(c.l.id,c.w); matches.set(c.l.id,c.same ? 'exact' : 'adjusted');
    audit.push({id:c.l.id,ratio,residual,lambda,...(c.unknown ? {reason:'unknown trim; subject-trim scenario, reduced weight'} : {})});
  }
  return {listings,weights,matches,audit};
}
