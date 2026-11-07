ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "tag" text;
CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "note" text DEFAULT '' NOT NULL,
  "work_date" date NOT NULL,
  "minutes" integer,
  "started_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "time_client_date_idx" ON "time_entries" ("client_id", "work_date");
CREATE INDEX IF NOT EXISTS "time_user_idx" ON "time_entries" ("user_id");
CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL
);
