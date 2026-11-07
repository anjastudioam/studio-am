CREATE TABLE "records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" text NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"status" text,
	"date" date,
	"amount_cents" bigint,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "records_module_idx" ON "records" USING btree ("module","date");
--> statement-breakpoint
CREATE INDEX "records_client_idx" ON "records" USING btree ("client_id","module");
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'IDEA';
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'IN_PRODUCTION';
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'INTERNAL_REVIEW';
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'READY';
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'PUBLISHED';
--> statement-breakpoint
ALTER TYPE "public"."post_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "title" text;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "campaign" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'NORMAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "notes" text;
