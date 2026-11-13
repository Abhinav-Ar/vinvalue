import { json, route } from '@/lib/http';
import { getDb } from '@/lib/db';
import { getProviders } from '@/lib/providers';
import { requireCronSecret } from '@/lib/jobs/cron';
import { runWeekly } from '@/lib/jobs/weekly';

/** 60s is valid on every Vercel plan; raise only after checking the plan's cap. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** GET /api/cron/weekly (Vercel cron, Authorization: Bearer CRON_SECRET) -> JobReport (counts only). */
export const GET = route({ auth: false, name: 'cron.weekly' }, async ({ req }) => {
  requireCronSecret(req);
  return json(await runWeekly(getDb(), getProviders(), new Date()));
});
