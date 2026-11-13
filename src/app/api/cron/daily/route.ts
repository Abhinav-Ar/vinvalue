import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { requireCronSecret } from '@/lib/jobs/cron';
import { runDaily } from '@/lib/jobs/daily';

/** 60s is valid on every Vercel plan; raise only after checking the plan's cap. Work per run is bounded in config. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** GET /api/cron/daily (Vercel cron, Authorization: Bearer CRON_SECRET) -> JobReport (counts only). */
export const GET = route({ auth: false, name: 'cron.daily' }, async ({ req }) => {
  requireCronSecret(req);
  return json(await runDaily(getDb(), getProviders(), new Date()));
});
