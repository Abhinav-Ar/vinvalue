import { json, route } from '@/models/http';
import { getDb } from '@/models/db';
import { getProviders } from '@/models/providers';
import { requireCronSecret } from '@/models/jobs/cron';
import { runDaily as runDailyModel } from '@/models/jobs/daily';
import { runWeekly as runWeeklyModel } from '@/models/jobs/weekly';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
/** 60s is valid on every Vercel plan; raise only after checking the plan's cap. Work per run is bounded in config. */

/** GET /api/cron/daily (Vercel cron, Authorization: Bearer CRON_SECRET) -> JobReport (counts only). */
export const runDaily = route({ auth: false, name: 'cron.daily' }, async ({ req }) => {
  requireCronSecret(req);
  return json(await runDailyModel(getDb(), getProviders(), new Date()));
});
/** 60s is valid on every Vercel plan; raise only after checking the plan's cap. */

/** GET /api/cron/weekly (Vercel cron, Authorization: Bearer CRON_SECRET) -> JobReport (counts only). */
export const runWeekly = route({ auth: false, name: 'cron.weekly' }, async ({ req }) => {
  requireCronSecret(req);
  return json(await runWeeklyModel(getDb(), getProviders(), new Date()));
});
