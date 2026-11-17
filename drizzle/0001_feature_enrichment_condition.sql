ALTER TABLE "appraisals" ADD COLUMN "enrichment" jsonb;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "dealer_name" text;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "dealer_city" text;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "vdp_url" text;--> statement-breakpoint
ALTER TABLE "comps" ADD COLUMN "photos" jsonb;