CREATE TABLE IF NOT EXISTS "category_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "category" text NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "amount" decimal NOT NULL CHECK ("amount" >= 0),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "category_budgets_user_category_month_unique" UNIQUE("user_id", "category", "year", "month")
);
