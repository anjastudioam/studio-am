import { sql } from "drizzle-orm";
import request from "supertest";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import { createDb } from "../src/db";
import { runMigrations } from "../src/db/migrate";
import { clients, users } from "../src/db/schema";
import { MemoryMailer } from "../src/mail/mailer";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://portal:portal@localhost:5432/portal_test";

export const cfg: Config = {
  NODE_ENV: "test",
  PORT: 0,
  BASE_URL: "https://portal.example.test",
  DATABASE_URL: TEST_DB,
  ADMIN_EMAIL: undefined,
  ADMIN_NAME: "Admin",
  ADMIN_PASSWORD: undefined,
  RESEND_API_KEY: undefined,
  MAIL_FROM: "Studio AM <portal@example.test>",
};

export async function setup(opts: { rateLimit?: boolean } = {}) {
  const { db, pool } = createDb(TEST_DB);
  await runMigrations(db);
  const mailer = new MemoryMailer();
  const app = createApp({ cfg, db, mailer, rateLimit: opts.rateLimit ?? false });
  return { db, pool, mailer, app };
}

export async function reset(db: Awaited<ReturnType<typeof setup>>["db"]) {
  await db.execute(
    sql`truncate table time_entries, app_settings, records, audit_log, post_events, posts, ideas, mood_items, tasks, notices, link_items, file_items, sessions, login_tokens, users, clients restart identity cascade`,
  );
}

export async function seedBasics(db: Awaited<ReturnType<typeof setup>>["db"]) {
  const [a] = await db.insert(clients).values({ name: "Alpha Co", slug: "alpha-co" }).returning();
  const [b] = await db.insert(clients).values({ name: "Bravo Co", slug: "bravo-co" }).returning();
  const [admin] = await db.insert(users).values({ email: "admin@studio.test", name: "Admin", role: "ADMIN" }).returning();
  const [alice] = await db.insert(users).values({ email: "alice@alpha.test", name: "Alice", role: "CLIENT", clientId: a.id }).returning();
  const [bob] = await db.insert(users).values({ email: "bob@bravo.test", name: "Bob", role: "CLIENT", clientId: b.id }).returning();
  return { a, b, admin, alice, bob };
}

/** Signs in through the real magic-link flow and returns an agent that holds the session cookie. */
export async function signIn(ctx: Awaited<ReturnType<typeof setup>>, email: string) {
  const before = ctx.mailer.sent.length;
  await request(ctx.app).post("/api/auth/request").send({ email }).expect(202);
  const mail = ctx.mailer.sent[before];
  if (!mail) throw new Error(`No sign-in email was sent to ${email}`);
  const token = /#token=([A-Za-z0-9_-]+)/.exec(mail.text)![1];
  const agent = request.agent(ctx.app);
  await agent.post("/api/auth/verify").send({ token }).expect(200);
  return agent;
}
