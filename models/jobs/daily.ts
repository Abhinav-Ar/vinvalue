/**
 * Daily job (Vercel cron, once a day on Hobby).
 *
 * MarketCheck usage per run (bounded by src/config/notifications.ts):
 *   - refreshVehicleValue: one comps search per vehicle (valuation's fetchComps; about 2 pages of 50),
 *     at most maxVehiclesPerRun vehicles, stalest lastAppraisedAt first so all vehicles rotate through.
 *   - takeMarketSnapshot: 2 requests per distinct (modelKey, zip) among the refreshed vehicles,
 *     at most maxSnapshotsPerRun, radius marketSnapshotRadiusMiles.
 *   Worst case ~ maxVehiclesPerRun * 2 + maxSnapshotsPerRun * 2 = 120 requests/day with defaults,
 *   and fewer in practice: provider calls stop at jobBudgetMs (wall clock) and the rest is deferred.
 *   Note: a vehicle whose refresh keeps failing keeps its old lastAppraisedAt and stays first in line.
 * Every step is isolated: one failure is counted and the rest still run.
 */
import { asc, sql } from 'drizzle-orm';
import type { Db } from '@/models/db';
import { vehicles } from '@/models/db/schema';
import type { Providers } from '@/models/providers';
import type { AlertDraft } from '@/shared/contracts';
import { notificationsConfig as cfg } from '@/models/config/notifications';
import { log } from '@/models/log';
import { refreshVehicleValue, purgeExpiredAnonymousAppraisals } from '@/models/appraisals/service';
import { dueMaintenanceAlerts, renewalAlerts } from '@/models/garage/maintenance';
import { takeMarketSnapshot } from '@/models/market/service';
import { checkPriceWatches, checkMarketWatches } from '@/models/watches/service';
import { revalueWatchedBuyChecks } from '@/models/buy/service';
import { purgeExpiredRateLimits } from '@/models/ratelimit';
import { createAlerts } from '@/models/alerts/service';
import { vehicleBadgeLabel } from '@/models/garage/labels';
import { drainDeliveries } from '@/models/notify/drain';
import { getSenders, type Senders } from '@/models/notify';
import { counter, type JobReport } from './types';
import { runPublicRecordsDaily } from './publicRecords';

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function valueChangeDraft(
  v: { id: string; userId: string; specs: typeof vehicles.$inferSelect.specs; trim: string | null; nickname: string | null },
  prev: number,
  next: number,
  today: string,
): AlertDraft | null {
  const delta = next - prev;
  if (Math.abs(delta) < cfg.valueChangeThreshold) return null;
  const label = vehicleBadgeLabel(v);
  return {
    userId: v.userId,
    type: 'value',
    vehicleId: v.id,
    title: `${label} is ${delta > 0 ? 'up' : 'down'} ${fmtUsd(Math.abs(delta))}`,
    body: `Private value is now ${fmtUsd(next)}.`,
    link: `/garage/${v.id}/value`,
    dedupeKey: `value:${v.id}:${today}`,
  };
}

export async function runDaily(
  db: Db,
  providers: Providers,
  now: Date,
  senders: Senders = getSenders(),
  opts: { budgetMs?: number } = {},
): Promise<JobReport> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? cfg.jobBudgetMs);
  const overBudget = () => Date.now() >= deadline;
  const today = now.toISOString().slice(0, 10);
  const c = counter();
  const publicRecords = await runPublicRecordsDaily(db, now);
  for (const [k, n] of Object.entries(publicRecords.counts)) c.add(`publicRecords_${k}`, n);
  const drafts: AlertDraft[] = [];

  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      c.add(`${name}Failures`);
      log.error('job.daily.step_failed', { step: name, err });
      return null;
    }
  };

  // 1. Refresh values (bounded, stalest first).
  const list = (await step('loadVehicles', () =>
    db
      .select()
      .from(vehicles)
      .orderBy(sql`${vehicles.lastAppraisedAt} asc nulls first`, asc(vehicles.id))
      .limit(cfg.maxVehiclesPerRun),
  )) ?? [];
  c.add('vehicles', list.length);
  const refreshed: typeof list = [];
  for (const v of list) {
    if (overBudget()) {
      c.add('deferredVehicles');
      continue;
    }
    refreshed.push(v);
    try {
      const report = await refreshVehicleValue(db, providers, v.id, now);
      c.add('valuesRefreshed');
      const next = report?.private?.value;
      if (v.lastPrivateValue !== null && typeof next === 'number') {
        const d = valueChangeDraft(v, v.lastPrivateValue, next, today);
        if (d) drafts.push(d);
      }
    } catch (err) {
      c.add('valueFailures');
      log.warn('job.daily.refresh_failed', { err });
    }
  }

  // 2. Price watches read the fresh lastPrivateValue and freshly re-valued watched buy checks.
  if (!overBudget()) {
    const rv = await step('revalueBuyChecks', () => revalueWatchedBuyChecks(db, providers, today));
    if (rv) {
      c.add('buyChecksRevalued', rv.updated);
      c.add('buyCheckRevalueFailures', rv.failed);
    }
  }
  drafts.push(...((await step('priceWatch', () => checkPriceWatches(db, today))) ?? []));

  // 3. Market snapshots for distinct (modelKey, zip) of refreshed vehicles, then market watches.
  const pairs = new Map<string, { modelKey: string; zip: string }>();
  for (const v of refreshed) pairs.set(`${v.modelKey}\u0000${v.zip}`, { modelKey: v.modelKey, zip: v.zip });
  for (const p of [...pairs.values()].slice(0, cfg.maxSnapshotsPerRun)) {
    if (overBudget()) {
      c.add('deferredSnapshots');
      continue;
    }
    const ok = await step('snapshot', () =>
      takeMarketSnapshot(db, providers, { ...p, radiusMiles: cfg.marketSnapshotRadiusMiles, date: today }),
    );
    if (ok) c.add('snapshots');
  }
  drafts.push(...((await step('marketWatch', () => checkMarketWatches(db, today))) ?? []));

  // 4. Garage alerts (DB only; always run).
  drafts.push(...((await step('maintenance', () => dueMaintenanceAlerts(db, today))) ?? []));
  drafts.push(...((await step('renewal', () => renewalAlerts(db, today))) ?? []));
  c.add('drafts', drafts.length);

  // 5. Persist + deliver.
  const created = await step('createAlerts', () => createAlerts(db, drafts, now));
  if (created) {
    c.add('alertsCreated', created.created);
    c.add('alertsDuplicate', created.skippedDuplicates);
    c.add('alertsInvalid', created.invalid);
  }
  const drained = await step('drain', () => drainDeliveries(db, now, senders));
  if (drained) for (const [k, n] of Object.entries(drained)) c.add(`delivery_${k}`, n);

  // 6. Housekeeping.
  const purged = await step('purgeAppraisals', () => purgeExpiredAnonymousAppraisals(db, now));
  if (purged !== null) c.add('appraisalsPurged', purged);
  await step('purgeRateLimits', () => purgeExpiredRateLimits());

  const report: JobReport = { job: 'daily', startedAt: now.toISOString(), ms: Date.now() - started, counts: c.counts };
  log.info('job.daily.done', { ms: report.ms, ...c.counts });
  return report;
}

