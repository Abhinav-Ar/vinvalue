/** Multiplicative correction is applied only after the model surface, never to comp ratios. */
import committed from '@/models/reference/data/bias-corrections.json';
import { z } from 'zod';
export const correctionSchema=z.object({
  version:z.literal(1), fittedAt:z.string(), dataWindow:z.object({from:z.string(),to:z.string()}),
  cells:z.array(z.object({segment:z.string(),n:z.number().int().min(30),families:z.number().int().min(2),factor:z.number().min(.75).max(1.25),shrinkage:z.number().min(0).max(1),holdout:z.object({n:z.number().int().min(30),families:z.number().int().min(2),before:z.number(),after:z.number(),p80Before:z.number(),p80After:z.number()})})),
});
export type Corrections=z.infer<typeof correctionSchema>;
export const committedCorrections:Corrections=correctionSchema.parse(committed);
export function correctionFactor(c:Corrections,segment:string) {
  return c.cells.find(x=>x.segment===segment)?.factor??1;
}
