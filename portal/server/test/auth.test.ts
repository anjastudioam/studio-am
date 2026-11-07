import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loginTokens, sessions, users } from "../src/db/schema";
import { hashToken } from "../src/auth/tokens";
import { reset, seedBasics, setup, signIn } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => {
  await ctx.pool.end();
});
beforeEach(async () => {
  await reset(ctx.db);
  ctx.mailer.sent.length = 0;
  await seedBasics(ctx.db);
});

describe("magic-link sign in", () => {
  it("signs a known user in and exposes who they are", async () => {
    const agent = await signIn(ctx, "alice@alpha.test");
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.email).toBe("alice@alpha.test");
    expect(me.body.user.role).toBe("CLIENT");
    expect(me.body.client.slug).toBe("alpha-co");
  });

  it("treats email case and spacing loosely", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "  ALICE@Alpha.test " }).expect(202);
    expect(ctx.mailer.sent).toHaveLength(1);
  });

  it("answers identically for unknown emails and sends nothing", async () => {
    const known = await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const unknown = await request(ctx.app).post("/api/auth/request").send({ email: "nobody@nowhere.test" });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(ctx.mailer.sent).toHaveLength(1); // only the known address got mail
  });

  it("does not email deactivated users", async () => {
    await ctx.db.update(users).set({ active: false }).where(eq(users.email, "alice@alpha.test"));
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" }).expect(202);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

  it("makes each link single-use", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0].text)![1];
    await request(ctx.app).post("/api/auth/verify").send({ token }).expect(200);
    await request(ctx.app).post("/api/auth/verify").send({ token }).expect(400);
  });

  it("only lets one of two simultaneous attempts use a link", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0].text)![1];
    const results = await Promise.all([
      request(ctx.app).post("/api/auth/verify").send({ token }),
      request(ctx.app).post("/api/auth/verify").send({ token }),
      request(ctx.app).post("/api/auth/verify").send({ token }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("rejects expired links", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0].text)![1];
    await ctx.db.update(loginTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(loginTokens.tokenHash, hashToken(token)));
    await request(ctx.app).post("/api/auth/verify").send({ token }).expect(400);
  });

  it("rejects made-up tokens", async () => {
    await request(ctx.app).post("/api/auth/verify").send({ token: "x".repeat(43) }).expect(400);
  });

  it("stores only hashes, never raw tokens", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0].text)![1];
    const rows = await ctx.db.select().from(loginTokens);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows[0].tokenHash).toBe(hashToken(token));
  });

  it("limits how many sign-in emails one account can trigger per hour", async () => {
    for (let i = 0; i < 8; i++) await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    expect(ctx.mailer.sent.length).toBe(5);
  });

  it("sets a hardened session cookie", async () => {
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(ctx.mailer.sent[0].text)![1];
    const res = await request(ctx.app).post("/api/auth/verify").send({ token }).expect(200);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("ends the session on logout", async () => {
    const agent = await signIn(ctx, "alice@alpha.test");
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
    expect(await ctx.db.select().from(sessions)).toHaveLength(0);
  });

  it("signs a user out everywhere when they are deactivated", async () => {
    const alice = await signIn(ctx, "alice@alpha.test");
    const admin = await signIn(ctx, "admin@studio.test");
    const [row] = await ctx.db.select().from(users).where(eq(users.email, "alice@alpha.test"));
    await admin.patch(`/api/admin/users/${row.id}`).send({ active: false }).expect(200);
    await alice.get("/api/auth/me").expect(401);
  });

  it("refuses unauthenticated access to everything private", async () => {
    await request(ctx.app).get("/api/auth/me").expect(401);
    await request(ctx.app).get("/api/c/alpha-co/home").expect(401);
    await request(ctx.app).get("/api/admin/clients").expect(401);
  });

  it("blocks cross-site writes", async () => {
    await request(ctx.app).post("/api/auth/request").set("Origin", "https://evil.example").send({ email: "alice@alpha.test" }).expect(403);
  });
});
