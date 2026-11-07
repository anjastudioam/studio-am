import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/src/db/schema.ts",
  out: "./server/drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://portal:portal@localhost:5432/portal_dev" },
});
