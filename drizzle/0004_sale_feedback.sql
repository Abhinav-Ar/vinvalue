CREATE TYPE outcome_route AS ENUM ('instant', 'private', 'retail', 'trade', 'auction');
--> statement-breakpoint
ALTER TABLE sale_outcomes ALTER COLUMN route TYPE outcome_route USING route::text::outcome_route;
--> statement-breakpoint
CREATE TABLE sale_feedback (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 vehicle_key text NOT NULL, appraisal_id text REFERENCES appraisals(id) ON DELETE SET NULL, snapshot jsonb NOT NULL, reason text NOT NULL,
 dismissed boolean NOT NULL DEFAULT false, completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX sale_feedback_vehicle_uq ON sale_feedback(vehicle_key);
--> statement-breakpoint
ALTER TABLE sale_outcomes ADD COLUMN feedback_id text REFERENCES sale_feedback(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE sale_outcomes ADD CONSTRAINT sale_outcomes_feedback_id_unique UNIQUE (feedback_id);
--> statement-breakpoint
ALTER TABLE sale_outcomes ADD COLUMN snapshot jsonb;
