import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "./index";

/** Applies pending SQL migrations. Safe to run on every start. */
export async function runMigrations(db: Db): Promise<void> {
  // Works from src (tsx/vitest) and from dist (compiled): the drizzle folder sits beside src/dist.
  const folder = path.resolve(__dirname, "../../drizzle");
  await migrate(db, { migrationsFolder: folder });
}
