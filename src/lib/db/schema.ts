/**
 * AutoIQ schema (Postgres, Drizzle). Money is stored as integer whole dollars
 * (valuations are rounded to $10 anyway; no float drift). Service costs are
 * integer cents because receipts have cents.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable, text, integer, timestamp, jsonb, boolean, date, primaryKey, uniqueIndex, index, pgEnum, real,
} from 'drizzle-orm/pg-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

/* ----------------------------------------------------------------- enums */
export const conditionEnum = pgEnum('condition', ['excellent', 'good', 'fair', 'rough']);
export const titleEnum = pgEnum('title_status', ['clean', 'rebuilt', 'salvage']);
export const accidentEnum = pgEnum('accident_history', ['none', 'minor', 'major']);
export const serviceHistoryEnum = pgEnum('service_history', ['full', 'partial', 'none']);
export const keysEnum = pgEnum('key_sets', ['two', 'one']);
export const warningLightsEnum = pgEnum('warning_lights', ['none', 'check_engine', 'other']);
export const saleRouteEnum = pgEnum('sale_route', ['instant', 'private', 'retail', 'trade']);
export const serviceStatusEnum = pgEnum('service_status', ['scheduled', 'done', 'skipped']);
export const documentKindEnum = pgEnum('document_kind', ['title', 'registration', 'insurance', 'receipt', 'inspection', 'other']);
export const sellerTypeEnum = pgEnum('seller_type', ['dealer', 'private']);
export const watchDirectionEnum = pgEnum('watch_direction', ['below', 'above']);
export const alertTypeEnum = pgEnum('alert_type', ['recall', 'maintenance', 'value', 'price_target', 'renewal', 'market']);
export const channelEnum = pgEnum('channel', ['in_app', 'email', 'push', 'sms']);
export const digestEnum = pgEnum('email_digest', ['instant', 'recalls_instant_rest_weekly', 'weekly']);
export const odometerSourceEnum = pgEnum('odometer_source', ['manual', 'appraisal', 'service', 'purchase']);

/* ------------------------------------------------------------ auth (Auth.js) */
export const users = pgTable('users', {
  id: id(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  /** IANA time zone for quiet hours and digests, e.g. America/Chicago. */
  timeZone: text('time_zone').notNull().default('America/Chicago'),
  /** Next report number for this user (drives AQ-10A, AQ-10B ... codes). */
  nextReportSeq: integer('next_report_seq').notNull().default(0),
  createdAt: createdAt(),
});

export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

/* ------------------------------------------------------------- vehicles */
/** Shape of decoded specs stored on vehicles / buy_checks (see providers/types.ts DecodedVin). */
export type DecodedSpecs = {
  year: number; make: string; model: string;
  trimRaw: string | null; trimCandidates: string[];
  body: string | null; drive: string | null; engine: string | null; fuel: string | null;
  doors: number | null; plant: string | null; checkDigitValid: boolean;
};

export const vehicles = pgTable('vehicles', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vin: text('vin').notNull(),
  specs: jsonb('specs').$type<DecodedSpecs>().notNull(),
  /** Trim the user confirmed; null until they pick one. */
  trim: text('trim'),
  /** Normalized model key used by market snapshots: "ford|mustang|gt". */
  modelKey: text('model_key').notNull(),
  zip: text('zip').notNull(),
  odometer: integer('odometer').notNull(),
  nickname: text('nickname'),
  purchasePrice: integer('purchase_price'),
  purchaseDate: date('purchase_date', { mode: 'string' }),
  purchaseOdometer: integer('purchase_odometer'),
  /** Latest known values, denormalized from the newest appraisal for fast garage lists. */
  lastPrivateValue: integer('last_private_value'),
  lastAppraisedAt: timestamp('last_appraised_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index('vehicles_user_idx').on(t.userId),
  uniqueIndex('vehicles_user_vin_uq').on(t.userId, t.vin),
]);

export const odometerReadings = pgTable('odometer_readings', {
  id: id(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  miles: integer('miles').notNull(),
  recordedOn: date('recorded_on', { mode: 'string' }).notNull(),
  source: odometerSourceEnum('source').notNull(),
  createdAt: createdAt(),
}, (t) => [index('odo_vehicle_idx').on(t.vehicleId, t.recordedOn)]);

/* ------------------------------------------------------------ appraisals */
export type AppraisalInputs = {
  vin: string; trim: string | null; mileage: number; zip: string;
  condition: 'excellent' | 'good' | 'fair' | 'rough';
  title: 'clean' | 'rebuilt' | 'salvage';
  accidents: 'none' | 'minor' | 'major';
  serviceHistory: 'full' | 'partial' | 'none' | null;
  owners: 1 | 2 | 3 | null;
  keys: 'two' | 'one' | null;
  warningLights: 'none' | 'check_engine' | 'other' | null;
};
export type ValueRange = { value: number; low: number; high: number };
export type Adjustment = { key: string; label: string; amount: number; reason: string };
export type CompStats = { found: number; used: number; excluded: number; median: number; weightedMedian: number; avgMiles: number; radiusMiles: number };

export const appraisals = pgTable('appraisals', {
  id: id(),
  /** Null for anonymous runs. */
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  shareSlug: text('share_slug').notNull().unique(),
  /** Per-user sequence number; null for anonymous runs. Display code via reportCode(). */
  reportSeq: integer('report_seq'),
  inputs: jsonb('inputs').$type<AppraisalInputs>().notNull(),
  specs: jsonb('specs').$type<DecodedSpecs>().notNull(),
  privateValue: jsonb('private_value').$type<ValueRange>().notNull(),
  instantValue: jsonb('instant_value').$type<ValueRange>().notNull(),
  retailValue: jsonb('retail_value').$type<ValueRange>().notNull(),
  adjustments: jsonb('adjustments').$type<Adjustment[]>().notNull(),
  compStats: jsonb('comp_stats').$type<CompStats>().notNull(),
  /** Which value the user looks at as "their" number (Activity page "Route"). */
  route: saleRouteEnum('route').notNull().default('private'),
  /** Engine version so old reports stay explainable after formula changes. */
  engineVersion: text('engine_version').notNull(),
  /** Anonymous appraisals expire; saved ones (userId set) do not. */
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (t) => [
  index('appraisals_user_idx').on(t.userId, t.createdAt),
  index('appraisals_vehicle_idx').on(t.vehicleId, t.createdAt),
]);

export const comps = pgTable('comps', {
  id: id(),
  appraisalId: text('appraisal_id').notNull().references(() => appraisals.id, { onDelete: 'cascade' }),
  /** Provider listing id (not the VIN; we do not store other people's VINs). */
  listingId: text('listing_id').notNull(),
  price: integer('price').notNull(),
  miles: integer('miles').notNull(),
  distanceMiles: real('distance_miles'),
  year: integer('year').notNull(),
  trim: text('trim'),
  sellerType: text('seller_type'),
  daysOnMarket: integer('days_on_market'),
  weight: real('weight').notNull(),
  excludedAsOutlier: boolean('excluded_as_outlier').notNull().default(false),
}, (t) => [index('comps_appraisal_idx').on(t.appraisalId)]);

/* ----------------------------------------------------------- maintenance */
export const serviceEvents = pgTable('service_events', {
  id: id(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  /** Free-ish type key: oil_filter, tire_rotation, brake_fluid, brake_pads, battery, detail, tires, coolant, wipers, cabin_filter, inspection, other */
  type: text('type').notNull(),
  title: text('title').notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  odometer: integer('odometer'),
  costCents: integer('cost_cents'),
  shop: text('shop'),
  notes: text('notes'),
  receiptDocumentId: text('receipt_document_id'),
  status: serviceStatusEnum('status').notNull().default('scheduled'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (t) => [index('service_vehicle_date_idx').on(t.vehicleId, t.date)]);

export const serviceIntervals = pgTable('service_intervals', {
  id: id(),
  /** Either vehicle-specific or model-wide (modelKey). One of the two must be set. */
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  modelKey: text('model_key'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  everyMiles: integer('every_miles'),
  everyMonths: integer('every_months'),
  /** 'user' | 'default' | TODO(data source): 'manufacturer' */
  source: text('source').notNull().default('default'),
  createdAt: createdAt(),
}, (t) => [index('intervals_vehicle_idx').on(t.vehicleId), index('intervals_model_idx').on(t.modelKey)]);

export const documents = pgTable('documents', {
  id: id(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  kind: documentKindEnum('kind').notNull(),
  label: text('label'),
  /** Storage key/URL in the FileStore. */
  fileKey: text('file_key'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  expiresOn: date('expires_on', { mode: 'string' }),
  createdAt: createdAt(),
}, (t) => [index('documents_vehicle_idx').on(t.vehicleId)]);

/* --------------------------------------------------------- buy + watches */
export type BuyVerdict = {
  fairLow: number; fairHigh: number; mid: number;
  verdict: 'below' | 'fair' | 'above';
  suggestedOffer: number; compCount: number; computedAt: string;
};

export const buyChecks = pgTable('buy_checks', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vin: text('vin').notNull(),
  specs: jsonb('specs').$type<DecodedSpecs>().notNull(),
  trim: text('trim'),
  zip: text('zip').notNull(),
  askingPrice: integer('asking_price').notNull(),
  mileage: integer('mileage').notNull(),
  sellerType: sellerTypeEnum('seller_type').notNull(),
  verdict: jsonb('verdict').$type<BuyVerdict>().notNull(),
  createdAt: createdAt(),
}, (t) => [index('buy_checks_user_idx').on(t.userId)]);

export const priceWatches = pgTable('price_watches', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  buyCheckId: text('buy_check_id').references(() => buyChecks.id, { onDelete: 'cascade' }),
  threshold: integer('threshold').notNull(),
  direction: watchDirectionEnum('direction').notNull(),
  lastValue: integer('last_value'),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (t) => [index('price_watches_user_idx').on(t.userId)]);

export const marketWatches = pgTable('market_watches', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  modelKey: text('model_key').notNull(),
  zip: text('zip').notNull(),
  radiusMiles: integer('radius_miles').notNull(),
  thresholdPct: real('threshold_pct').notNull().default(3),
  baselineMedian: integer('baseline_median'),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
});

/* ---------------------------------------------------------------- market */
export type MarketAggregates = {
  count: number; medianPrice: number | null; medianDaysOnMarket: number | null;
  medianMiles: number | null;
  /** Bucket lower bounds in dollars and counts, equal width. */
  buckets: { from: number; to: number; count: number }[];
};

export const marketSnapshots = pgTable('market_snapshots', {
  id: id(),
  modelKey: text('model_key').notNull(),
  zip: text('zip').notNull(),
  radiusMiles: integer('radius_miles').notNull(),
  snapshotDate: date('snapshot_date', { mode: 'string' }).notNull(),
  aggregates: jsonb('aggregates').$type<MarketAggregates>().notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('market_snap_uq').on(t.modelKey, t.zip, t.radiusMiles, t.snapshotDate)]);

/* --------------------------------------------------------------- recalls */
export type RecallItem = {
  campaign: string; component: string; summary: string; consequence: string; remedy: string;
  reportedOn: string | null; parkIt: boolean; parkOutside: boolean;
};

export const recallChecks = pgTable('recall_checks', {
  id: id(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  /** 'model_year' today (NHTSA public API). 'vin' once a VIN-level source exists. */
  basis: text('basis').notNull(),
  results: jsonb('results').$type<RecallItem[]>().notNull(),
}, (t) => [index('recall_vehicle_idx').on(t.vehicleId, t.checkedAt)]);

/* ---------------------------------------------------------------- alerts */
export const alerts = pgTable('alerts', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: alertTypeEnum('type').notNull(),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  /** Stops daily jobs from re-alerting the same thing: e.g. "maint:<eventId>:overdue". */
  dedupeKey: text('dedupe_key'),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (t) => [
  index('alerts_user_idx').on(t.userId, t.createdAt),
  uniqueIndex('alerts_dedupe_uq').on(t.userId, t.dedupeKey),
]);

/** Outbox for non-in-app channels; the delivery worker drains it respecting prefs/quiet hours. */
export const alertDeliveries = pgTable('alert_deliveries', {
  id: id(),
  alertId: text('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  channel: channelEnum('channel').notNull(),
  /** pending | sent | skipped | failed | digest */
  status: text('status').notNull().default('pending'),
  notBefore: timestamp('not_before', { withTimezone: true, mode: 'date' }),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
}, (t) => [index('deliveries_status_idx').on(t.status, t.notBefore)]);

export const notificationPrefs = pgTable('notification_prefs', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  alertType: alertTypeEnum('alert_type').notNull(),
  channel: channelEnum('channel').notNull(),
  enabled: boolean('enabled').notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.alertType, t.channel] })]);

export const notificationSettings = pgTable('notification_settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emailDigest: digestEnum('email_digest').notNull().default('recalls_instant_rest_weekly'),
  /** "HH:MM" local time in users.timeZone; null = no quiet hours. */
  quietStart: text('quiet_start'),
  quietEnd: text('quiet_end'),
  /** E.164, only set after verification. */
  phoneE164: text('phone_e164'),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true, mode: 'date' }),
  smsConsentAt: timestamp('sms_consent_at', { withTimezone: true, mode: 'date' }),
  /** Exact consent wording shown, for the record. */
  smsConsentText: text('sms_consent_text'),
  updatedAt: updatedAt(),
});

export const smsVerifications = pgTable('sms_verifications', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phoneE164: text('phone_e164').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAt(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: id(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: createdAt(),
});

/* ----------------------------------------------------------- rate limits */
export const rateLimits = pgTable('rate_limits', {
  /** sha256(rule + client id) + window start; no raw IPs stored. */
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const _sql = sql; // re-export for raw fragments in migrations if needed
