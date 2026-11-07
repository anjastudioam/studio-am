import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileItems, ideas, linkItems, moodItems, notices, posts, tasks } from "../src/db/schema";
import { reset, seedBasics, setup, signIn } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof seedBasics>>;
let adminAgent: ReturnType<typeof request.agent>;
let alphaRows: Record<string, string>;
let bravoRows: Record<string, string>;

beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => {
  await ctx.pool.end();
});

async function seedContent(clientId: string, tag: string) {
  const [l] = await ctx.db.insert(linkItems).values({ clientId, type: "PINTEREST", title: `${tag} link`, url: "https://example.com/" + tag }).returning();
  const [f] = await ctx.db.insert(fileItems).values({ clientId, folder: "AGREEMENTS", title: `${tag} agreement`, url: "https://example.com/" + tag }).returning();
  const [p] = await ctx.db
    .insert(posts)
    .values({ clientId, publishDate: "2099-01-01", platform: "Instagram", caption: `${tag} caption`, status: "AWAITING_APPROVAL", internalNote: `${tag} SECRET NOTE` })
    .returning();
  const [d] = await ctx.db
    .insert(posts)
    .values({ clientId, publishDate: "2099-01-02", platform: "Instagram", caption: `${tag} draft`, status: "DRAFT" })
    .returning();
  const [i] = await ctx.db.insert(ideas).values({ clientId, title: `${tag} idea` }).returning();
  const [m] = await ctx.db.insert(moodItems).values({ clientId, imageUrl: "https://example.com/" + tag + ".jpg" }).returning();
  const [t] = await ctx.db.insert(tasks).values({ clientId, title: `${tag} task` }).returning();
  const [n] = await ctx.db.insert(notices).values({ clientId, title: `${tag} notice` }).returning();
  return { links: l.id, files: f.id, posts: p.id, draft: d.id, ideas: i.id, mood: m.id, tasks: t.id, notices: n.id };
}

beforeEach(async () => {
  await reset(ctx.db);
  ctx.mailer.sent.length = 0;
  s = await seedBasics(ctx.db);
  alphaRows = await seedContent(s.a.id, "alpha");
  bravoRows = await seedContent(s.b.id, "bravo");
  adminAgent = await signIn(ctx, "admin@studio.test");
});

const sections = ["links", "files", "posts", "ideas", "mood", "tasks", "notices"] as const;

describe("client scoping (staff work on one named client at a time)", () => {
  it("each client address only ever returns that client's rows in every section", async () => {
    for (const section of sections) {
      const res = await adminAgent.get(`/api/c/alpha-co/${section}`).expect(200);
      const blob = JSON.stringify(res.body);
      expect(blob, section).not.toContain("bravo");
      expect(blob, section).toContain("alpha");
    }
  });

  it("unknown clients are a plain 404", async () => {
    await adminAgent.get("/api/c/nobody/home").expect(404);
  });

  it("cannot read, change or delete another client's row by id, even through the wrong client address", async () => {
    await adminAgent.patch(`/api/c/alpha-co/tasks/${bravoRows.tasks}`).send({ done: true }).expect(404);
    await adminAgent.get(`/api/c/alpha-co/posts/${bravoRows.posts}/events`).expect(404);
    await adminAgent.delete(`/api/c/alpha-co/notices/${bravoRows.notices}`).expect(404);
    const bravoTasks = (await adminAgent.get("/api/c/bravo-co/tasks").expect(200)).body;
    expect(bravoTasks).toHaveLength(1);
    expect(bravoTasks[0].done).toBe(false);
    expect(await adminAgent.get("/api/c/bravo-co/notices").then((r) => r.body)).toHaveLength(1);
  });

  it("ignores a clientId smuggled into a request body", async () => {
    const res = await adminAgent.post("/api/c/alpha-co/tasks").send({ title: "x", clientId: s.b.id });
    expect(res.status).toBe(400); // strict schema rejects unknown fields
    const ok = await adminAgent.post("/api/c/alpha-co/ideas").send({ title: "mine" }).expect(201);
    expect(ok.body.clientId).toBe(s.a.id);
    expect(JSON.stringify((await adminAgent.get("/api/c/bravo-co/ideas")).body)).not.toContain("mine");
  });

  it("the home summary only contains the named client", async () => {
    const res = await adminAgent.get("/api/c/alpha-co/home").expect(200);
    expect(JSON.stringify(res.body)).not.toContain("bravo");
    expect(res.body.awaitingApproval).toBe(1);
  });

  it("rejects malformed ids without leaking database errors", async () => {
    const res = await adminAgent.patch("/api/c/alpha-co/tasks/not-a-uuid").send({ done: true }).expect(404);
    expect(JSON.stringify(res.body)).not.toMatch(/select|postgres|syntax/i);
  });
});

describe("clients have no access at all", () => {
  it("client accounts cannot sign in by link", async () => {
    ctx.mailer.sent.length = 0;
    await request(ctx.app).post("/api/auth/request").send({ email: "alice@alpha.test" }).expect(202);
    expect(ctx.mailer.sent).toHaveLength(0);
  });

  it("client accounts cannot sign in by password", async () => {
    const { users } = await import("../src/db/schema");
    const { hashPassword } = await import("../src/auth/password");
    const { eq } = await import("drizzle-orm");
    await ctx.db.update(users).set({ passwordHash: await hashPassword("a long enough phrase") }).where(eq(users.id, s.alice.id));
    await request(ctx.app).post("/api/auth/login").send({ email: "alice@alpha.test", password: "a long enough phrase" }).expect(401);
  });

  it("a client session, even if one existed, is refused", async () => {
    const { sessions } = await import("../src/db/schema");
    const { newToken, hashToken } = await import("../src/auth/tokens");
    const token = newToken();
    await ctx.db.insert(sessions).values({ userId: s.alice.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 86_400_000) });
    await request(ctx.app).get("/api/auth/me").set("Cookie", `sam_session=${token}`).expect(401);
    await request(ctx.app).get("/api/c/alpha-co/home").set("Cookie", `sam_session=${token}`).expect(401);
  });

  it("the old approval and client-user endpoints are gone", async () => {
    await adminAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "APPROVE" }).expect(404);
    await adminAgent.post(`/api/admin/clients/${s.a.id}/users`).send({ email: "x@y.test", name: "X" }).expect(404);
  });
});

describe("input validation", () => {
  it("only accepts https links", async () => {
    const bad = ["javascript:alert(1)", "http://insecure.test", "data:text/html,hi", "not a url", "ftp://x.test"];
    for (const url of bad) {
      await adminAgent.post("/api/c/alpha-co/links").send({ type: "INSPO", title: "x", url }).expect(400);
    }
    await adminAgent.post("/api/c/alpha-co/links").send({ type: "INSPO", title: "x", url: "https://good.test/a" }).expect(201);
  });

  it("rejects unknown section names and unknown fields", async () => {
    await adminAgent.get("/api/c/alpha-co/users").expect(404);
    await adminAgent.post("/api/c/alpha-co/tasks").send({ title: "x", done: true, evil: 1 }).expect(400);
  });

  it("handles stored text containing markup safely (returned as data, never executed by the API)", async () => {
    const res = await adminAgent.post("/api/c/alpha-co/notices").send({ title: "<script>alert(1)</script>", body: "<img src=x onerror=alert(1)>" }).expect(201);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("admin", () => {
  it("creates clients with unique, safe slugs", async () => {
    const one = await adminAgent.post("/api/admin/clients").send({ name: "Café  Müller & Sons!" }).expect(201);
    expect(one.body.slug).toBe("cafe-muller-sons");
    const two = await adminAgent.post("/api/admin/clients").send({ name: "Café Müller & Sons" }).expect(201);
    expect(two.body.slug).toBe("cafe-muller-sons-2");
  });

  it("lists clients with what needs attention", async () => {
    const res = await adminAgent.get("/api/admin/clients").expect(200);
    const alpha = res.body.find((c: any) => c.slug === "alpha-co");
    expect(alpha.awaitingApproval).toBe(1);
    expect(alpha.openTasks).toBe(1);
  });

  it("shows every client's posts in one master list, and only to admins", async () => {
    const res = await adminAgent.get("/api/admin/posts").expect(200);
    const slugs = new Set(res.body.map((p: any) => p.clientSlug));
    expect(slugs.has("alpha-co") && slugs.has("bravo-co")).toBe(true);
    expect(res.body.length).toBe(4); // 2 posts per client, drafts included
    expect(JSON.stringify(res.body)).toContain("SECRET NOTE");
    await request(ctx.app).get("/api/admin/posts").expect(401);
    await adminAgent.patch(`/api/admin/clients/${s.b.id}`).send({ status: "ARCHIVED" }).expect(200);
    const after = await adminAgent.get("/api/admin/posts").expect(200);
    expect(after.body.every((p: any) => p.clientSlug === "alpha-co")).toBe(true);
  });

  it("lists every client's to-dos for the dashboard, admins only", async () => {
    const res = await adminAgent.get("/api/admin/tasks").expect(200);
    expect(res.body.map((t: any) => t.clientSlug).sort()).toEqual(["alpha-co", "bravo-co"]);
    await request(ctx.app).get("/api/admin/tasks").expect(401);
  });

  it("writes an audit trail", async () => {
    await adminAgent.post("/api/c/alpha-co/notices").send({ title: "Hello" }).expect(201);
    const log = (await adminAgent.get("/api/admin/audit").expect(200)).body;
    const actions = log.map((l: any) => l.action);
    expect(actions).toContain("notices.create");
    expect(actions).toContain("auth.login");
  });

  it("loads demo data flagged as demo, and removes only that, with everything it owns", async () => {
    expect((await adminAgent.get("/api/admin/demo-data").expect(200)).body.loaded).toBe(false);
    await adminAgent.post("/api/admin/demo-data").expect(201);
    expect((await adminAgent.post("/api/admin/demo-data").expect(200)).body.loaded).toBe(true);
    const list = (await adminAgent.get("/api/admin/clients").expect(200)).body;
    expect(list.filter((c: any) => c.isDemo)).toHaveLength(2);
    const removed = (await adminAgent.delete("/api/admin/demo-data").expect(200)).body.removed;
    expect(removed).toBe(2);
    const after = (await adminAgent.get("/api/admin/clients").expect(200)).body.map((c: any) => c.slug).sort();
    expect(after).toEqual(["alpha-co", "bravo-co"]); // real clients untouched
    expect(JSON.stringify((await adminAgent.get("/api/admin/posts")).body)).not.toContain("Sunrise");
    await request(ctx.app).delete("/api/admin/demo-data").expect(401);
  });
});
