CREATE TYPE "public"."accident_history" AS ENUM('none', 'minor', 'major');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('recall', 'maintenance', 'value', 'price_target', 'renewal', 'market');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('in_app', 'email', 'push', 'sms');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('excellent', 'good', 'fair', 'rough');--> statement-breakpoint
CREATE TYPE "public"."email_digest" AS ENUM('instant', 'recalls_instant_rest_weekly', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('title', 'registration', 'insurance', 'receipt', 'inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."key_sets" AS ENUM('two', 'one');--> statement-breakpoint
CREATE TYPE "public"."odometer_source" AS ENUM('manual', 'appraisal', 'service', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."sale_route" AS ENUM('instant', 'private', 'retail', 'trade');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('dealer', 'private');--> statement-breakpoint
CREATE TYPE "public"."service_history" AS ENUM('full', 'partial', 'none');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('scheduled', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."title_status" AS ENUM('clean', 'rebuilt', 'salvage');--> statement-breakpoint
CREATE TYPE "public"."warning_lights" AS ENUM('none', 'check_engine', 'other');--> statement-breakpoint
CREATE TYPE "public"."watch_direction" AS ENUM('below', 'above');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"not_before" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "alert_type" NOT NULL,
	"vehicle_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appraisals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"vehicle_id" text,
	"share_slug" text NOT NULL,
	"report_seq" integer,
	"inputs" jsonb NOT NULL,
	"specs" jsonb NOT NULL,
	"private_value" jsonb NOT NULL,
	"instant_value" jsonb NOT NULL,
	"retail_value" jsonb NOT NULL,
	"adjustments" jsonb NOT NULL,
	"comp_stats" jsonb NOT NULL,
	"route" "sale_route" DEFAULT 'private' NOT NULL,
	"method_version" text NOT NULL,
	"confidence" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appraisals_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "buy_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vin" text NOT NULL,
	"specs" jsonb NOT NULL,
	"trim" text,
	"zip" text NOT NULL,
	"asking_price" integer NOT NULL,
	"mileage" integer NOT NULL,
	"seller_type" "seller_type" NOT NULL,
	"verdict" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comps" (
	"id" text PRIMARY KEY NOT NULL,
	"appraisal_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"price" integer NOT NULL,
	"miles" integer NOT NULL,
	"distance_miles" real,
	"year" integer NOT NULL,
	"trim" text,
	"seller_type" text,
	"days_on_market" integer,
	"weight" real NOT NULL,
	"excluded_as_outlier" boolean DEFAULT false NOT NULL,
	"trim_match" text DEFAULT 'exact' NOT NULL,
	"adjusted_price" integer,
	"search_tier" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"kind" "document_kind" NOT NULL,
	"label" text,
	"file_key" text,
	"content_type" text,
	"size_bytes" integer,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"model_key" text NOT NULL,
	"zip" text NOT NULL,
	"radius_miles" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"aggregates" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_watches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_key" text NOT NULL,
	"zip" text NOT NULL,
	"radius_miles" integer NOT NULL,
	"threshold_pct" real DEFAULT 3 NOT NULL,
	"baseline_median" integer,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" text NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"channel" "channel" NOT NULL,
	"enabled" boolean NOT NULL,
	CONSTRAINT "notification_prefs_user_id_alert_type_channel_pk" PRIMARY KEY("user_id","alert_type","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_digest" "email_digest" DEFAULT 'recalls_instant_rest_weekly' NOT NULL,
	"quiet_start" text,
	"quiet_end" text,
	"phone_e164" text,
	"phone_verified_at" timestamp with time zone,
	"sms_consent_at" timestamp with time zone,
	"sms_consent_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odometer_readings" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"miles" integer NOT NULL,
	"recorded_on" date NOT NULL,
	"source" "odometer_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_watches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" text,
	"buy_check_id" text,
	"threshold" integer NOT NULL,
	"direction" "watch_direction" NOT NULL,
	"last_value" integer,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recall_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"basis" text NOT NULL,
	"results" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" text,
	"appraisal_id" text,
	"sold_price" integer NOT NULL,
	"route" "sale_route" NOT NULL,
	"sold_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_events" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"odometer" integer,
	"cost_cents" integer,
	"shop" text,
	"notes" text,
	"receipt_document_id" text,
	"status" "service_status" DEFAULT 'scheduled' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_intervals" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text,
	"model_key" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"every_miles" integer,
	"every_months" integer,
	"source" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"consent_text" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"time_zone" text DEFAULT 'America/Chicago' NOT NULL,
	"next_report_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vin" text NOT NULL,
	"specs" jsonb NOT NULL,
	"trim" text,
	"model_key" text NOT NULL,
	"zip" text NOT NULL,
	"odometer" integer NOT NULL,
	"nickname" text,
	"purchase_price" integer,
	"purchase_date" date,
	"purchase_odometer" integer,
	"last_private_value" integer,
	"last_appraised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "vin_decodes" (
	"vin" text PRIMARY KEY NOT NULL,
	"raw" jsonb NOT NULL,
	"decoded" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appraisals" ADD CONSTRAINT "appraisals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buy_checks" ADD CONSTRAINT "buy_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comps" ADD CONSTRAINT "comps_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_watches" ADD CONSTRAINT "market_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_watches" ADD CONSTRAINT "price_watches_buy_check_id_buy_checks_id_fk" FOREIGN KEY ("buy_check_id") REFERENCES "public"."buy_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recall_checks" ADD CONSTRAINT "recall_checks_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_outcomes" ADD CONSTRAINT "sale_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_outcomes" ADD CONSTRAINT "sale_outcomes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_outcomes" ADD CONSTRAINT "sale_outcomes_appraisal_id_appraisals_id_fk" FOREIGN KEY ("appraisal_id") REFERENCES "public"."appraisals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_intervals" ADD CONSTRAINT "service_intervals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_verifications" ADD CONSTRAINT "sms_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "alert_deliveries" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "alerts_user_idx" ON "alerts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_dedupe_uq" ON "alerts" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "appraisals_user_idx" ON "appraisals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "appraisals_vehicle_idx" ON "appraisals" USING btree ("vehicle_id","created_at");--> statement-breakpoint
CREATE INDEX "buy_checks_user_idx" ON "buy_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comps_appraisal_idx" ON "comps" USING btree ("appraisal_id");--> statement-breakpoint
CREATE INDEX "documents_vehicle_idx" ON "documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_snap_uq" ON "market_snapshots" USING btree ("model_key","zip","radius_miles","snapshot_date");--> statement-breakpoint
CREATE INDEX "odo_vehicle_idx" ON "odometer_readings" USING btree ("vehicle_id","recorded_on");--> statement-breakpoint
CREATE INDEX "price_watches_user_idx" ON "price_watches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recall_vehicle_idx" ON "recall_checks" USING btree ("vehicle_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_outcome_vehicle_uq" ON "sale_outcomes" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "service_vehicle_date_idx" ON "service_events" USING btree ("vehicle_id","date");--> statement-breakpoint
CREATE INDEX "intervals_vehicle_idx" ON "service_intervals" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "intervals_model_idx" ON "service_intervals" USING btree ("model_key");--> statement-breakpoint
CREATE INDEX "vehicles_user_idx" ON "vehicles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_user_vin_uq" ON "vehicles" USING btree ("user_id","vin");