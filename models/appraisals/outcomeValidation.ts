import { z } from 'zod';
import { dollarsSchema, isoDateSchema } from '@/models/validation';
export const outcomeSchema = z.object({
  soldPrice: dollarsSchema().refine(n => n >= 500, 'Sale price must be at least $500.'),
  route: z.enum(['private', 'trade', 'instant', 'auction', 'retail']),
  soldOn: isoDateSchema.refine(s => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s <= new Date().toISOString().slice(0, 10);
  }, 'Enter a valid sale date that is not in the future.'),
});
