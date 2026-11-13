/**
 * Notification defaults and job tuning (alerts workstream, M5).
 * Default prefs mirror design/Alerts.dc.html (the `def` matrix in its x-dc script).
 */
import type { channelEnum, digestEnum } from '@/lib/db/schema';
import type { AlertType } from '@/lib/contracts';

export type Channel = (typeof channelEnum.enumValues)[number];
export type EmailDigest = (typeof digestEnum.enumValues)[number];
export type ChannelFlags = Record<Channel, boolean>;
export type PrefsMatrix = Record<AlertType, ChannelFlags>;

export const ALERT_TYPES: AlertType[] = ['recall', 'maintenance', 'value', 'price_target', 'renewal', 'market'];
export const CHANNELS: Channel[] = ['in_app', 'email', 'push', 'sms'];

const row = (in_app: 0 | 1, email: 0 | 1, push: 0 | 1, sms: 0 | 1): ChannelFlags => ({
  in_app: !!in_app, email: !!email, push: !!push, sms: !!sms,
});

/** [in_app, email, push, sms], exactly as the design. */
export const DEFAULT_PREFS: PrefsMatrix = {
  recall: row(1, 1, 1, 1),
  maintenance: row(1, 1, 1, 0),
  value: row(1, 1, 0, 0),
  price_target: row(1, 1, 1, 0),
  renewal: row(1, 1, 0, 1),
  market: row(1, 0, 0, 0),
};

export const DEFAULT_EMAIL_DIGEST: EmailDigest = 'recalls_instant_rest_weekly';

export const notificationsConfig = {
  /** Value-change alert fires when |new - previous private value| >= this (whole dollars). */
  valueChangeThreshold: 500,
  /** Vehicles refreshed per daily run (stalest first). Each refresh costs MarketCheck calls. */
  maxVehiclesPerRun: 40,
  /** Vehicles recall-checked per weekly run (NHTSA, free). */
  maxRecallChecksPerRun: 1000,
  /** Distinct (modelKey, zip) market snapshots per daily run. */
  maxSnapshotsPerRun: 20,
  marketSnapshotRadiusMiles: 100,
  /**
   * Wall-clock budget for provider calls in one cron run (ms). Must stay well under the route's
   * maxDuration (60s) so the provider-free tail (createAlerts, drain, purges) always runs.
   * Work past the budget is deferred to the next run and counted.
   */
  jobBudgetMs: 40_000,
  /** Delivery retries: attempts before 'failed', and delay before attempt n+1 (minutes). */
  maxDeliveryAttempts: 3,
  retryBackoffMinutes: [5, 30],
  /** Max outbox rows handled per drain call. */
  drainBatchSize: 500,
  /** SMS verification. */
  smsCodeTtlMinutes: 10,
  smsMaxAttempts: 5,
  /** Alerts list page size. */
  alertsPageSize: 20,
} as const;
