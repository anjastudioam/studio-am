ALTER TABLE "clients" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TYPE "public"."client_status" ADD VALUE IF NOT EXISTS 'ONBOARDING';
