import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileItems, ideas, linkItems, moodItems, notices, posts, tasks } from "../src/db/schema";
import { reset, seedBasics, setup, signIn } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof seedBasics>>;
let aliceAgent: ReturnType<typeof request.agent>;
let bobAgent: ReturnType<typeof request.agent>;
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
  aliceAgent = await signIn(ctx, "alice@alpha.test");
  bobAgent = await signIn(ctx, "bob@bravo.test");
  adminAgent = await signIn(ctx, "admin@studio.test");
});

const sections = ["links", "files", "posts", "ideas", "mood", "tasks", "notices"] as const;

describe("tenant isolation", () => {
  it("a client only ever sees their own rows in every section", async () => {
    for (const section of sections) {
      const res = await aliceAgent.get(`/api/c/alpha-co/${section}`).expect(200);
      const blob = JSON.stringify(res.body);
      expect(blob, section).not.toContain("bravo");
      expect(blob, section).toContain("alpha");
    }
  });

  it("a client asking for another client's portal gets 404, same as a client that does not exist", async () => {
    const other = await aliceAgent.get("/api/c/bravo-co/home");
    const missing = await aliceAgent.get("/api/c/no-such-client/home");
    expect(other.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(other.body).toEqual(missing.body);
    for (const section of sections) {
      await aliceAgent.get(`/api/c/bravo-co/${section}`).expect(404);
    }
  });

  it("cannot read, change or delete another client's row by id, even through their own portal address", async () => {
    // Bravo's task id, but sent to Alpha's portal.
    await aliceAgent.patch(`/api/c/alpha-co/tasks/${bravoRows.tasks}`).send({ done: true }).expect(404);
    await aliceAgent.post(`/api/c/alpha-co/posts/${bravoRows.posts}/respond`).send({ decision: "APPROVE" }).expect(404);
    await aliceAgent.get(`/api/c/alpha-co/posts/${bravoRows.posts}/events`).expect(404);
    await adminAgent.delete(`/api/c/alpha-co/notices/${bravoRows.notices}`).expect(404); // even an admin must name the right client
    const [t] = await ctx.db.select().from(tasks);
    expect(t).toBeTruthy();
    const bravoTasks = (await bobAgent.get("/api/c/bravo-co/tasks").expect(200)).body;
    expect(bravoTasks[0].done).toBe(false);
    expect(bravoTasks).toHaveLength(1);
    const bravoNotices = (await bobAgent.get("/api/c/bravo-co/notices").expect(200)).body;
    expect(bravoNotices).toHaveLength(1);
  });

  it("ignores a clientId smuggled into a request body", async () => {
    const res = await adminAgent.post("/api/c/alpha-co/tasks").send({ title: "x", clientId: s.b.id });
    expect(res.status).toBe(400); // strict schema rejects unknown fields
    const ok = await aliceAgent.post("/api/c/alpha-co/ideas").send({ title: "mine" }).expect(201);
    expect(ok.body.clientId).toBe(s.a.id);
    const bravoIdeas = (await bobAgent.get("/api/c/bravo-co/ideas").expect(200)).body;
    expect(JSON.stringify(bravoIdeas)).not.toContain("mine");
  });

  it("the home summary only contains the caller's client", async () => {
    const res = await aliceAgent.get("/api/c/alpha-co/home").expect(200);
    expect(JSON.stringify(res.body)).not.toContain("bravo");
    expect(res.body.awaitingApproval).toBe(1);
  });

  it("an admin can open any client when they name it", async () => {
    const a = await adminAgent.get("/api/c/alpha-co/home").expect(200);
    const b = await adminAgent.get("/api/c/bravo-co/home").expect(200);
    expect(JSON.stringify(a.body)).not.toContain("bravo");
    expect(JSON.stringify(b.body)).not.toContain("alpha");
  });

  it("archived clients disappear for their own users but not for admins", async () => {
    await adminAgent.patch(`/api/admin/clients/${s.a.id}`).send({ status: "ARCHIVED" }).expect(200);
    await aliceAgent.get("/api/c/alpha-co/home").expect(404);
    await adminAgent.get("/api/c/alpha-co/home").expect(200);
  });

  it("client users can never reach the admin area", async () => {
    await aliceAgent.get("/api/admin/clients").expect(403);
    await aliceAgent.post("/api/admin/clients").send({ name: "Sneaky" }).expect(403);
    await aliceAgent.get("/api/admin/audit").expect(403);
    await aliceAgent.post(`/api/admin/clients/${s.a.id}/users`).send({ email: "x@y.test", name: "X" }).expect(403);
  });

  it("rejects malformed ids without leaking database errors", async () => {
    const res = await aliceAgent.patch("/api/c/alpha-co/tasks/not-a-uuid").send({ done: true });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/sql|postgres|uuid/i);
  });
});

describe("what clients may do", () => {
  it("cannot create or edit links, files or notices", async () => {
    await aliceAgent.post("/api/c/alpha-co/links").send({ type: "PINTEREST", title: "x", url: "https://x.test" }).expect(403);
    await aliceAgent.post("/api/c/alpha-co/files").send({ folder: "REPORTS", title: "x", url: "https://x.test" }).expect(403);
    await aliceAgent.post("/api/c/alpha-co/notices").send({ title: "x" }).expect(403);
    await aliceAgent.patch(`/api/c/alpha-co/links/${alphaRows.links}`).send({ title: "hacked" }).expect(403);
    await aliceAgent.delete(`/api/c/alpha-co/files/${alphaRows.files}`).expect(403);
  });

  it("can tick a task but not change anything else about it", async () => {
    const ok = await aliceAgent.patch(`/api/c/alpha-co/tasks/${alphaRows.tasks}`).send({ done: true }).expect(200);
    expect(ok.body.done).toBe(true);
    expect(ok.body.doneAt).toBeTruthy();
    await aliceAgent.patch(`/api/c/alpha-co/tasks/${alphaRows.tasks}`).send({ title: "renamed" }).expect(400);
    await aliceAgent.delete(`/api/c/alpha-co/tasks/${alphaRows.tasks}`).expect(403);
  });

  it("can add tasks, ideas and moodboard items", async () => {
    const t = await aliceAgent.post("/api/c/alpha-co/tasks").send({ title: "Send logo files", owner: "AGENCY" }).expect(201);
    expect(t.body.owner).toBe("CLIENT"); // a client cannot assign work to the agency
    await aliceAgent.post("/api/c/alpha-co/ideas").send({ title: "Behind the scenes reel" }).expect(201);
    await aliceAgent.post("/api/c/alpha-co/mood").send({ imageUrl: "https://example.com/a.jpg", tags: ["warm"] }).expect(201);
  });

  it("can edit only the ideas they created", async () => {
    const mine = await aliceAgent.post("/api/c/alpha-co/ideas").send({ title: "mine" }).expect(201);
    await aliceAgent.patch(`/api/c/alpha-co/ideas/${mine.body.id}`).send({ title: "mine, updated" }).expect(200);
    await aliceAgent.patch(`/api/c/alpha-co/ideas/${alphaRows.ideas}`).send({ title: "not mine" }).expect(403);
  });

  it("never sees drafts or internal notes", async () => {
    const list = (await aliceAgent.get("/api/c/alpha-co/posts").expect(200)).body;
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("SECRET NOTE");
    expect(JSON.stringify(list)).not.toContain("internalNote");
    await aliceAgent.patch(`/api/c/alpha-co/posts/${alphaRows.draft}`).send({ caption: "x" }).expect(403);
    await aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.draft}/respond`).send({ decision: "APPROVE" }).expect(404);
    const home = (await aliceAgent.get("/api/c/alpha-co/home").expect(200)).body;
    expect(JSON.stringify(home)).not.toContain("SECRET NOTE");
    const admin = (await adminAgent.get("/api/c/alpha-co/posts").expect(200)).body;
    expect(admin).toHaveLength(2);
    expect(JSON.stringify(admin)).toContain("SECRET NOTE");
  });

  it("cannot set a post's status directly, only respond to it", async () => {
    await aliceAgent.patch(`/api/c/alpha-co/posts/${alphaRows.posts}`).send({ status: "POSTED" }).expect(403);
    await aliceAgent.post("/api/c/alpha-co/posts").send({ publishDate: "2099-01-01", platform: "X" }).expect(403);
  });
});

describe("approvals", () => {
  it("lets a client approve a post and records who did it", async () => {
    const res = await aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "APPROVE" }).expect(200);
    expect(res.body.status).toBe("APPROVED");
    const events = (await aliceAgent.get(`/api/c/alpha-co/posts/${alphaRows.posts}/events`).expect(200)).body;
    expect(events).toHaveLength(1);
    expect(events[0].fromStatus).toBe("AWAITING_APPROVAL");
    expect(events[0].toStatus).toBe("APPROVED");
    expect(events[0].actorUserId).toBe(s.alice.id);
  });

  it("requires a reason when asking for changes", async () => {
    await aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "REQUEST_CHANGES" }).expect(400);
    const ok = await aliceAgent
      .post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`)
      .send({ decision: "REQUEST_CHANGES", comment: "Use the green logo" })
      .expect(200);
    expect(ok.body.status).toBe("CHANGES_REQUESTED");
  });

  it("only lets a post be answered once", async () => {
    await aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "APPROVE" }).expect(200);
    await aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "APPROVE" }).expect(409);
  });

  it("settles two simultaneous answers to exactly one winner", async () => {
    const results = await Promise.all([
      aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "APPROVE" }),
      aliceAgent.post(`/api/c/alpha-co/posts/${alphaRows.posts}/respond`).send({ decision: "REQUEST_CHANGES", comment: "no" }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    const events = (await adminAgent.get(`/api/c/alpha-co/posts/${alphaRows.posts}/events`).expect(200)).body;
    expect(events).toHaveLength(1);
  });

  it("records agency status changes too", async () => {
    await adminAgent.patch(`/api/c/alpha-co/posts/${alphaRows.draft}`).send({ status: "AWAITING_APPROVAL" }).expect(200);
    const events = (await adminAgent.get(`/api/c/alpha-co/posts/${alphaRows.draft}/events`).expect(200)).body;
    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe("AWAITING_APPROVAL");
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

  it("invites a client user, who can then sign in", async () => {
    const c = await adminAgent.post("/api/admin/clients").send({ name: "Charlie Ltd" }).expect(201);
    await adminAgent.post(`/api/admin/clients/${c.body.id}/users`).send({ email: "Chuck@Charlie.test", name: "Chuck", sendInvite: true }).expect(201);
    await adminAgent.post(`/api/admin/clients/${c.body.id}/users`).send({ email: "chuck@charlie.test", name: "Dup" }).expect(409);
    const agent = await signIn(ctx, "chuck@charlie.test");
    await agent.get("/api/c/charlie-ltd/home").expect(200);
    await agent.get("/api/c/alpha-co/home").expect(404);
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
    await aliceAgent.get("/api/admin/posts").expect(403);
    await adminAgent.patch(`/api/admin/clients/${s.b.id}`).send({ status: "ARCHIVED" }).expect(200);
    const after = await adminAgent.get("/api/admin/posts").expect(200);
    expect(after.body.every((p: any) => p.clientSlug === "alpha-co")).toBe(true);
  });

  it("writes an audit trail", async () => {
    await adminAgent.post("/api/c/alpha-co/notices").send({ title: "Hello" }).expect(201);
    const log = (await adminAgent.get("/api/admin/audit").expect(200)).body;
    const actions = log.map((l: any) => l.action);
    expect(actions).toContain("notices.create");
    expect(actions).toContain("auth.login");
  });
});
