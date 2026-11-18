import type { DecodedSpecs } from '@/models/db/schema';
import { valuationConfig, type ValuationConfig } from '@/models/config/valuation';
import { resolveReference, exactName, type ReferenceData } from '@/models/reference';
import { clamp } from '@/models/stats';
import { AppError } from '@/models/errors';
/** Friendly 422; the standard controller route wrapper serializes AppError subclasses. */
export class NotEnoughDataError extends AppError {
  constructor(reason: string) { super(422, 'invalid_input', `Not enough data to estimate this vehicle: ${reason}`, undefined, { reason: 'needs_reference' }); this.name = 'NotEnoughDataError'; }
}
export function evaluateSurface(specs: Pick<DecodedSpecs, 'year' | 'make' | 'model' | 'transmission'>, trim: string | null, miles: number, now: Date, data: ReferenceData, config: ValuationConfig = valuationConfig) {
  const p = config.surface;
  const age = now.getUTCFullYear() - specs.year;
  if (age < 0 || !Number.isFinite(miles) || miles < 0) throw new NotEnoughDataError('confirm model year and actual mileage.');
  const ref = resolveReference(data, specs, trim);
  const { msrpRow: m, generationRef: g, variantRef: v } = ref;
  if (!m || !data.cpi) throw new NotEnoughDataError('a documented MSRP anchor and CPI reference are required.');
  // A year-range MSRP is quoted in msrpModelYear dollars; CPI-shift to model year,
  // then inflate to as-of. These operations cancel to CPI(asOf)/CPI(msrpModelYear).
  const cpi = data.cpi.rows.filter(r => r.year <= now.getUTCFullYear()).sort((a,b) => b.year-a.year)[0];
  const original = data.cpi.rows.find(r => r.year === m.msrpModelYear);
  if (!cpi || !original) throw new NotEnoughDataError('the anchor year has no CPI observation.');
  const manual = exactName(specs.transmission ?? '') === 'manual';
  const scarcity = g && g.E >= p.scarcityDemandMin && v?.productionScope === 'us' && v.productionCount != null ? (p.scarcity.find(b=>v.productionCount!<=b.max)?.score ?? 0) : 0;
  // Missing facts contribute zero to D but reduce coverage. Curated zero facts retain coverage.
  const features = { E: g?.E ?? 0, P: v?.P ?? 0, L: scarcity, I: g?.I ?? 0, T: manual && v?.manualPreferred ? 1 : 0, B: g?.B ?? 0, H: g?.H ?? 0 };
  const confidence = { E: g ? 1 : 0, P: v ? 1 : 0, L: v?.productionCount != null ? 1 : 0, I: g ? 1 : 0, T: v && (!v.manualPreferred || manual || specs.transmission) ? 1 : 0, B: g ? 1 : 0, H: g ? 1 : 0 };
  let D = 0, q = 0;
  for (const key of Object.keys(features) as Array<keyof typeof features>) { D += p.weights[key] * features[key] * confidence[key]; q += p.weights[key] * confidence[key]; }
  D = clamp(D, 0, 1);
  const segment = config.familySegments[`${exactName(m.make)}/${exactName(m.model)}`] ?? (g?.segment === 'supercar' ? 'sports' : g?.segment) ?? 'other';
  const fitted = config.segmentCalibration[segment];
  const brand = config.brandCalibration[exactName(specs.make)] ?? 1;
  const retentionPrior = config.retentionPriors.find(r => r.make === exactName(specs.make) && r.segment === segment);
  const k = (p.k-p.kD*D) * (fitted ? fitted.k * brand : retentionPrior?.kMultiplier ?? 1);
  const F = clamp((p.floor+p.floorD2*D*D)*(fitted ? fitted.floor / brand : retentionPrior?.floorMultiplier ?? 1), 0, 1);
  const f = p.f-p.fD*D;
  const eligible = D > p.growthThreshold && q >= p.plateauCoverage && !!g && !!v;
  const override = g?.G === 1 ? config.generationCurvePriors[`${exactName(specs.make)}/${exactName(specs.model)}/${exactName(g.generation)}`] : undefined;
  const approved = override && override.sourceUrls.length > 0 ? override : undefined;
  const onset = approved?.onset ?? p.onset-p.onsetD*D;
  const b = eligible ? Math.min(age, onset) : age;
  const r0 = (1-f)*(F+(1-F)*Math.exp(-k*b));
  // Optional onsetRetention rescales the eligible curve continuously, including pre-onset.
  const onsetBase = (1-f)*(F+(1-F)*Math.exp(-k*onset));
  const onsetScale = eligible && approved?.onsetRetention ? approved.onsetRetention/onsetBase : 1;
  const growth = eligible && g?.G === 1 ? (approved?.growth ?? p.growth*clamp((D-p.growthThreshold)/(1-p.growthThreshold),0,1)) : 0;
  const growthLog = growth*Math.max(0,age-onset);
  const growthCap = approved?.growthCap ?? p.growthCap;
  const retentionCap = approved?.retentionCap ?? p.retentionCap;
  const R = Math.min(retentionCap,r0*onsetScale*Math.exp(Math.min(Math.log(growthCap),growthLog)));
  const mRef = p.milesPerYear*(1-p.milesD*D)*Math.min(age,p.milesAgeCap);
  const beta = p.beta+p.betaD2*D*D, eta = p.eta*D*D*Math.min(age/p.etaAge,1);
  const h = (n:number) => Math.max(0,Math.log(p.lowMilesThreshold/(n+p.milesOffset)));
  const rawL = -beta*Math.log((miles+p.milesOffset)/(mRef+p.milesOffset))+eta*(h(miles)-h(mRef));
  const cap = Math.log(p.mileageCap)+D*D*Math.log(p.collectorMileageCap/p.mileageCap);
  const L = clamp(rawL,-cap,cap), M = m.msrpUsd*cpi.value/original.value;
  const caps = Math.abs(rawL) > cap || growthLog > Math.log(growthCap) || R >= retentionCap;
  const unknown = (v?.manualPreferred && !manual && !specs.transmission ? p.unknownTransmissionLog : 0)+(D > .6 ? p.unknownOdometerLog+p.unknownOriginalityLog : 0);
  const uncertainty = p.coverageLog*(1-q)+p.anchorLog*({ documented: 0, inferred: .4, approximate: 1 } as const)[m.confidence]+unknown+(caps ? p.capLog : 0)+p.extrapLog*Math.max(0,age-p.extrapAge);
  const modelUncertainty = uncertainty - p.coverageLog*(1-q) - p.anchorLog*({ documented: 0, inferred: .4, approximate: 1 } as const)[m.confidence] + p.modelCoverageLog*(1-q) + p.modelAnchorLog*({ documented: 0, inferred: .4, approximate: 1 } as const)[m.confidence];
  return { ...ref, segment, D, q, M, R, L, H: M*R*Math.exp(L)*(now.getUTCFullYear() >= 2021 ? fitted?.market ?? 1 : 1), age, caps, uncertainty, modelUncertainty, factors: Object.entries(features).filter(([,value]) => value>0).map(([key,value]) => `${({E:'Enthusiast demand',P:'Performance engineering',L:'Documented limited supply',I:'Iconic status',T:'Confirmed preferred manual',B:'Preferred body',H:'Historic generation'} as Record<string,string>)[key]}: ${value.toFixed(2)}`), cpiVintage: data.cpi.retrievedAt, k, F, onset };
}
export type Surface = ReturnType<typeof evaluateSurface>;
