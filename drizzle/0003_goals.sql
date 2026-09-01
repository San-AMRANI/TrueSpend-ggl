-- Phase 3: Financial Goals table
CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "target_amount" decimal NOT NULL,
  "current_amount" decimal DEFAULT '0' NOT NULL,
  "deadline" timestamp,
  "category" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
