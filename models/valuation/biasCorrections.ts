/** Model-only corrections, keyed by canonical make/model/generation. */
import committed from '@/models/reference/data/bias-corrections.json';
import { z } from 'zod';
import { exactName } from '@/models/reference';
const cell=z.object({segment:z.string(),n:z.number().int().positive(),factor:z.number().min(.5).max(2),shrinkage:z.number().min(0).max(1),ci:z.tuple([z.number().positive(),z.number().positive()]),wideCap:z.boolean()}).refine(c=>c.wideCap||c.factor>=.75&&c.factor<=1.25,'Sparse/uncertain factors must stay within ±25%').refine(c=>!c.wideCap||c.n>=100&&c.ci[1]/c.ci[0]<=1.1/.9,'Wide cap requires n>=100 and tight CI');
export const correctionSchema=z.object({version:z.literal(2),methodVersion:z.enum(['2.3.0','2.3.1']),fittedAt:z.string(),dataWindow:z.object({from:z.string(),to:z.string()}),cells:z.array(cell),families:z.array(cell.and(z.object({family:z.string()})))});
export type Corrections=z.infer<typeof correctionSchema>;
export const committedCorrections:Corrections=correctionSchema.parse(committed);
export const correctionFamily=(r:{make:string;model:string;generation:string})=>[r.make,r.model,r.generation].map(exactName).join('/');
export function correctionFactor(c:Corrections,_segment:string,family?:string) {
  return (family?c.families.find(x=>x.family===family)?.factor:undefined)??1;
}
