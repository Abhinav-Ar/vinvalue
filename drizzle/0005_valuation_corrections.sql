CREATE TABLE valuation_corrections (
 id text PRIMARY KEY,
 snapshot jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE valuation_accuracy_reports (
 month text PRIMARY KEY,
 report jsonb NOT NULL,
 markdown text NOT NULL,
 drift jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
