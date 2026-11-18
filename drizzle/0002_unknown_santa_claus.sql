CREATE TABLE "public_record_job_state" (
	"job" text PRIMARY KEY NOT NULL,
	"offset" integer DEFAULT 0 NOT NULL,
	"watermark" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_record_popularity" (
	"id" text PRIMARY KEY NOT NULL,
	"source_dataset" text NOT NULL,
	"state" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"model_year" integer NOT NULL,
	"period" date NOT NULL,
	"vehicle_count" integer NOT NULL,
	"refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_record_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"source_dataset" text NOT NULL,
	"row_hash" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"model_year" integer NOT NULL,
	"sale_price" integer NOT NULL,
	"odometer" integer,
	"transaction_month" date NOT NULL,
	"transaction_date" date NOT NULL,
	"transaction_type" text NOT NULL,
	"county" text,
	"state" text DEFAULT 'WA' NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "public_record_sales_row_hash_unique" UNIQUE("row_hash")
);
--> statement-breakpoint
ALTER TABLE "appraisals" ALTER COLUMN "enrichment" SET DEFAULT 'null'::jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "public_popularity_key" ON "public_record_popularity" USING btree ("source_dataset","state","make","model","model_year","period");--> statement-breakpoint
CREATE INDEX "public_popularity_lookup_idx" ON "public_record_popularity" USING btree ("state","make","model","model_year");--> statement-breakpoint
CREATE INDEX "public_sales_lookup_idx" ON "public_record_sales" USING btree ("make","model","model_year","transaction_date");--> statement-breakpoint
CREATE INDEX "public_sales_watermark_idx" ON "public_record_sales" USING btree ("source_dataset","transaction_date");