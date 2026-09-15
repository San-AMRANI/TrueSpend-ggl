CREATE TABLE IF NOT EXISTS "payrolls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "scheduled_for" timestamp NOT NULL,
  "amount" decimal NOT NULL CHECK ("amount" > 0),
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payroll_id" uuid REFERENCES "payrolls"("id");
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_payroll_id_unique"
  ON "transactions" ("payroll_id") WHERE "payroll_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "notification_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "token" text NOT NULL UNIQUE,
  "enabled" boolean DEFAULT true NOT NULL,
  "time" text DEFAULT '09:00' NOT NULL,
  "timezone" text NOT NULL,
  "last_sent_on" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
