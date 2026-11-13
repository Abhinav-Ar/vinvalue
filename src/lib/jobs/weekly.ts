/**
 * Weekly job: recall checks (NHTSA, free, no MarketCheck usage), weekly email
 * digests, then a drain for the recall alerts just enqueued.
 */
import { asc } from 'drizzle-orm';
import type { Db } from '@/lib/db';
import { vehicles } from '@/lib/db/schema';
import type { Providers } from '@/lib/providers';
import type { AlertDraft } from '@/lib/contracts';
import { notificationsConfig as cfg } from '@/config/notifications';
import { log } from '@/lib/log';
import { checkRecalls } from '@/lib/recalls/service';
import { createAlerts } from '@/lib/alerts/service';
import { drainDeliveries } from '@/lib/notify/drain';
import { buildWeeklyDigests } from '@/lib/notify/digest';
import { getSenders, type Senders } from '@/lib/notify';
import { counter, type JobReport } from './types';

/** Per-run memo so vehicles sharing a make/model/year cost one NHTSA call. */
function memoRecalls(p: Providers): Providers {
  const cache = new Map<string, ReturnType<Providers['recalls']['byModelYear']>>();
  return {
    ...p,
    recalls: {
      byModelYear(make, model, year) {
        const k = `${make}|${model}|${year}`.toLowerCase();
        let hit = cache.get(k);
        if (!hit) {
          hit = p.recalls.byModelYear(make, model, year);
          hit.catch(() => cache.delete(k));
          cache.set(k, hit);
        }
        return hit;
      },
    },
  };
}

export async function runWeekly(
  db: Db,
  providers: Providers,
  now: Date,
  senders: Senders = getSenders(),
  opts: { budgetMs?: number } = {},
): Promise<JobReport> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? cfg.jobBudgetMs);
  const memo = memoRecalls(providers);
  const c = counter();
  const drafts: AlertDraft[] = [];

  // Bounded by count and wall clock. TODO: rotate (oldest recall check first) once garages outgrow one run.
  const list = await db.select({ id: vehicles.id }).from(vehicles).orderBy(asc(vehicles.createdAt), asc(vehicles.id)).limit(cfg.maxRecallChecksPerRun);
  c.add('vehicles', list.length);
  for (const v of list) {
    if (Date.now() >= deadline) {
      c.add('deferredVehicles');
      continue;
    }
    try {
      const r = await checkRecalls(db, memo, v.id, now);
      c.add('recallChecks');
      c.add('newCampaigns', r.newCampaigns.length);
      drafts.push(...r.drafts);
    } catch (err) {
      c.add('recallFailures');
      log.warn('job.weekly.recall_failed', { err });
    }
  }

  const steps: [string, () => Promise<void>][] = [
    ['createAlerts', async () => {
      const r = await createAlerts(db, drafts, now);
      c.add('alertsCreated', r.created);
      c.add('alertsDuplicate', r.skippedDuplicates);
      c.add('alertsInvalid', r.invalid);
    }],
    ['digest', async () => {
      const r = await buildWeeklyDigests(db, now, senders);
      for (const [k, n] of Object.entries(r)) c.add(`digest_${k}`, n);
    }],
    ['drain', async () => {
      const r = await drainDeliveries(db, now, senders);
      for (const [k, n] of Object.entries(r)) c.add(`delivery_${k}`, n);
    }],
  ];
  for (const [name, fn] of steps) {
    try {
      await fn();
    } catch (err) {
      c.add(`${name}Failures`);
      log.error('job.weekly.step_failed', { step: name, err });
    }
  }

  const report: JobReport = { job: 'weekly', startedAt: now.toISOString(), ms: Date.now() - started, counts: c.counts };
  log.info('job.weekly.done', { ms: report.ms, ...c.counts });
  return report;
}
