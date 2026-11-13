import { z } from 'zod';
import { json, parseQuery, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { getValueTracker } from '@/lib/forecast/service';
import { isoToday } from '@/lib/market/service';
import { forecastConfig } from '@/config/forecast';

const Query = z.object({
  milesPerYear: z.coerce
    .number({ error: 'Miles per year must be a number.' })
    .int('Use whole miles.')
    .min(0, 'Miles per year cannot be negative.')
    .max(forecastConfig.maxMilesPerYear, `Miles per year must be ${forecastConfig.maxMilesPerYear.toLocaleString('en-US')} or less.`)
    .optional(),
});

/** GET /api/vehicles/[id]/value?milesPerYear=: appraisal history + 12-month forecast. */
export const GET = route<{ id: string }, true>({ auth: true, name: 'vehicles.value' }, async ({ req, params, userId }) => {
  const q = parseQuery(req, Query);
  return json(await getValueTracker(getDb(), userId, params.id, { milesPerYear: q.milesPerYear, today: isoToday() }));
});
