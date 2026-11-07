import { loadConfig } from "../config";
import { createDb } from "./index";
import { runMigrations } from "./migrate";

async function main() {
  const cfg = loadConfig();
  const { db, pool } = createDb(cfg.DATABASE_URL);
  await runMigrations(db);
  await pool.end();
  console.log("Migrations applied.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
