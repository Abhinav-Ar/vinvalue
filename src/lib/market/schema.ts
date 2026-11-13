import { z } from 'zod';
import { radiusSchema, zipSchema } from '@/lib/validation';

/** "make|model|trim" (trim may be empty), lowercase as produced by modelKey(). */
export const modelKeySchema = z
  .string({ error: 'Pick a model.' })
  .trim()
  .toLowerCase()
  .regex(/^[^|]{1,40}\|[^|]{1,60}\|[^|]{0,60}$/, 'Model key must look like "make|model|trim".');

export const MarketWatchBody = z.object({
  modelKey: modelKeySchema,
  zip: zipSchema,
  radiusMiles: radiusSchema,
  thresholdPct: z.coerce.number().min(0.5, 'Use at least 0.5%.').max(50, 'Use 50% or less.').optional(),
});
