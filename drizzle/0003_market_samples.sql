CREATE TABLE "market_sample_usage" (
	"month" text PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"stopped" text,
	"quota_remaining" integer,
	"rate_remaining" integer,
	"rate_reset" text,
	"lease_until" timestamp with time zone,
	"lease_token" text
);
--> statement-breakpoint
CREATE TABLE "market_samples" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"trim" text,
	"miles" integer NOT NULL,
	"price" integer NOT NULL,
	"seller_type" text,
	"inventory_type" text,
	"days_on_market" integer,
	"zip" text NOT NULL,
	"radius" integer NOT NULL,
	"sample_month" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"listing_hash" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_samples_month_listing" ON "market_samples" USING btree ("sample_month","listing_hash");