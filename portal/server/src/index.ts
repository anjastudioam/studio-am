import path from "node:path";
import { createApp } from "./app";
import { ensureAdmin } from "./bootstrap";
import { loadConfig } from "./config";
import { createDb } from "./db";
import { runMigrations } from "./db/migrate";
import { startRecurringJob } from "./jobs/recurring";
import { ConsoleMailer, NullMailer, ResendMailer } from "./mail/mailer";

async function main() {
  const cfg = loadConfig();
  const { db, pool } = createDb(cfg.DATABASE_URL);
  await runMigrations(db);
  await ensureAdmin(db, cfg.ADMIN_EMAIL, cfg.ADMIN_NAME, cfg.ADMIN_PASSWORD);

  const mailer = cfg.RESEND_API_KEY
    ? new ResendMailer(cfg.RESEND_API_KEY, cfg.MAIL_FROM)
    : cfg.NODE_ENV === "production"
      ? new NullMailer()
      : new ConsoleMailer();
  const app = createApp({ cfg, db, mailer, clientDir: path.resolve(__dirname, "../../client/dist") });

  const server = app.listen(cfg.PORT, () => console.log(`Studio AM portal listening on ${cfg.PORT}`));
  const stopJobs = startRecurringJob(db);
  const shutdown = () => {
    stopJobs();
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error("Failed to start:", e instanceof Error ? e.message : e);
  process.exit(1);
});
