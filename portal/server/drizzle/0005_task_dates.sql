-- Every open to-do needs a date so it appears on the calendar.
UPDATE "tasks" SET "due_date" = ("created_at" AT TIME ZONE 'Africa/Johannesburg')::date WHERE "due_date" IS NULL AND "done" = false;
