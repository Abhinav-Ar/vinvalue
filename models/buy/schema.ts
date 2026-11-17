import { z } from 'zod';
import { dollarsSchema, mileageSchema, vinSchema, zipSchema } from '@/models/validation';

/** Body for POST /api/price-check and POST /api/buy-checks. */
export const PriceCheckBody = z.object({
  vin: vinSchema,
  askingPrice: dollarsSchema(),
  mileage: mileageSchema,
  sellerType: z.enum(['dealer', 'private'], { error: 'Pick dealer or private seller.' }),
  zip: zipSchema,
  trim: z.string().trim().max(60).nullish(),
  importedVehicle: z.boolean().optional(),
});
