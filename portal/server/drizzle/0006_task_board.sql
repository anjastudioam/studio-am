ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'TODO';
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "subtasks" jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE "tasks" SET "status" = 'DONE' WHERE "done" = true;
