import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MODULES } from "../src/modules/registry";
import { clients, tasks } from "../src/db/schema";
import { reset, seedBasics, setup, signIn } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
let s: Awaited<ReturnType<typeof seedBasics>>;
let admin: ReturnType<typeof request.agent>;

beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => {
  await ctx.pool.end();
});
beforeEach(async () => {
  await reset(ctx.db);
  ctx.mailer.sent.length = 0;
  s = await seedBasics(ctx.db);
  admin = await signIn(ctx, "admin@studio.test");
});

const iso = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

describe("module records", () => {
  it("is for signed-in staff only", async () => {
    await request(ctx.app).get("/api/admin/records/projects").expect(401);
    await request(ctx.app).get("/api/admin/records/modules").expect(401);
  });

  it("describes every module for the interface", async () => {
    const res = await admin.get("/api/admin/records/modules").expect(200);
    expect(res.body.map((m: any) => m.key)).toEqual(MODULES.map((m) => m.key));
  });

  it("creates, lists, edits and deletes a project, merging data fields", async () => {
    const c = await admin
      .post("/api/admin/records/projects")
      .send({ title: "Rebrand", clientId: s.a.id, amount: 15000, date: iso(10), data: { type: "Branding", priority: "High" } })
      .expect(201);
    expect(c.body.status).toBe("PLANNING");
    expect(c.body.amount).toBe(15000);
    expect(c.body.clientSlug).toBe("alpha-co");
    const p = await admin.patch(`/api/admin/records/projects/${c.body.id}`).send({ status: "ACTIVE", data: { priority: "Urgent" } }).expect(200);
    expect(p.body.data).toEqual({ type: "Branding", priority: "Urgent" });
    const list = await admin.get("/api/admin/records/projects?client=alpha-co&status=ACTIVE").expect(200);
    expect(list.body).toHaveLength(1);
    expect((await admin.get("/api/admin/records/projects?client=bravo-co")).body).toHaveLength(0);
    await admin.delete(`/api/admin/records/projects/${c.body.id}`).expect(200);
    expect((await admin.get("/api/admin/records/projects")).body).toHaveLength(0);
  });

  it("validates: required client, unknown fields, bad statuses, non-https links, wrong module", async () => {
    await admin.post("/api/admin/records/projects").send({ title: "No client" }).expect(400);
    await admin.post("/api/admin/records/projects").send({ title: "x", clientId: s.a.id, data: { evil: 1 } }).expect(400);
    await admin.post("/api/admin/records/projects").send({ title: "x", clientId: s.a.id, status: "NOPE" }).expect(400);
    await admin.post("/api/admin/records/links").send({ title: "x", data: { url: "javascript:alert(1)" } }).expect(400);
    await admin.post("/api/admin/records/links").send({ title: "x", data: { url: "http://insecure.test" } }).expect(400);
    await admin.post("/api/admin/records/links").send({ title: "ok", data: { url: "https://good.test" } }).expect(201);
    await admin.post("/api/admin/records/finance").send({ title: "Invoice", clientId: s.a.id, data: { docType: "Invoice" } }).expect(400); // amount needed
    await admin.get("/api/admin/records/nothing").expect(404);
  });

  it("does not let a record be moved onto a client that does not exist", async () => {
    await admin.post("/api/admin/records/projects").send({ title: "x", clientId: "00000000-0000-4000-8000-000000000000" }).expect(400);
  });

  it("works out overdue invoices and summarises money", async () => {
    await admin.post("/api/admin/records/finance").send({ title: "Late", clientId: s.a.id, amount: 1000, status: "SENT", date: iso(-5), data: { docType: "Invoice" } }).expect(201);
    await admin.post("/api/admin/records/finance").send({ title: "Fine", clientId: s.a.id, amount: 500, status: "SENT", date: iso(5), data: { docType: "Invoice" } }).expect(201);
    await admin.post("/api/admin/records/finance").send({ title: "Done", clientId: s.a.id, amount: 250, status: "PAID", date: iso(-9), data: { docType: "Invoice" } }).expect(201);
    const list = (await admin.get("/api/admin/records/finance")).body;
    expect(list.find((x: any) => x.title === "Late").overdue).toBe(true);
    expect(list.find((x: any) => x.title === "Fine").overdue).toBe(false);
    const tiles = (await admin.get("/api/admin/records/finance/summary")).body.tiles;
    const by = Object.fromEntries(tiles.map((t: any) => [t.label, t.value]));
    expect(by).toEqual({ Outstanding: 1500, Overdue: 1000, Paid: 250 });
  });

  it("averages audit scores", async () => {
    const r = await admin
      .post("/api/admin/records/audits")
      .send({ title: "Brand audit", clientId: s.a.id, data: { auditType: "Brand", scoreStrategy: 6, scoreQuality: 8 } })
      .expect(201);
    expect(r.body.data.overall).toBe(7);
  });

  it("turns an idea into a to-do or a project, and needs a client for it", async () => {
    const idea = (await admin.post("/api/admin/records/ideas").send({ title: "Behind the scenes reel", data: { priority: "High" } }).expect(201)).body;
    await admin.post(`/api/admin/records/ideas/${idea.id}/actions/toTask`).send({}).expect(400);
    await admin.post(`/api/admin/records/ideas/${idea.id}/actions/toTask`).send({ clientId: s.a.id }).expect(200);
    await admin.post(`/api/admin/records/ideas/${idea.id}/actions/toProject`).send({ clientId: s.a.id }).expect(200);
    const t = await ctx.db.select().from(tasks);
    expect(t).toHaveLength(1);
    expect(t[0].priority).toBe("HIGH");
    const proj = (await admin.get("/api/admin/records/projects?client=alpha-co")).body;
    expect(proj).toHaveLength(1);
    expect(proj[0].status).toBe("PLANNING");
  });

  it("turns meeting action items into to-dos once only", async () => {
    const m = (await admin.post("/api/admin/records/meetings").send({ title: "Kick-off", clientId: s.a.id, data: { actionItems: "- Send brief\n2. Book shoot\n\n" } }).expect(201)).body;
    const done = await admin.post(`/api/admin/records/meetings/${m.id}/actions/actionsToTasks`).send({}).expect(200);
    expect(done.body.message).toContain("2");
    expect((await ctx.db.select().from(tasks)).map((x) => x.title).sort()).toEqual(["Book shoot", "Send brief"]);
    await admin.post(`/api/admin/records/meetings/${m.id}/actions/actionsToTasks`).send({}).expect(409);
  });

  it("stores prospect research on a lead and averages the scores out of 5", async () => {
    const lead = (
      await admin
        .post("/api/admin/records/leads")
        .send({ title: "Corner Café", data: { businessType: "Coffee shop", website: "https://example.com", scoreBrand: 2, scoreSocial: 4, scoreGoogle: 3, gaps: "Menu is a PDF", suggestedPackage: "Starter" } })
        .expect(201)
    ).body;
    expect(lead.data.overall).toBe(3);
    const upd = await admin.patch(`/api/admin/records/leads/${lead.id}`).send({ status: "RESEARCHED", data: { scoreWebsite: 5, researchedBy: "By hand" } }).expect(200);
    expect(upd.body.status).toBe("RESEARCHED");
    expect(upd.body.data.overall).toBe(3.5);
    expect(upd.body.data.gaps).toBe("Menu is a PDF");
    // A lead with no scores yet has no overall figure.
    const bare = (await admin.post("/api/admin/records/leads").send({ title: "No research yet" }).expect(201)).body;
    expect(bare.data.overall).toBeNull();
    // Research scores stop at 5, links must be https, and unknown fields are refused.
    await admin.post("/api/admin/records/leads").send({ title: "x", data: { scoreBrand: 6 } }).expect(400);
    await admin.post("/api/admin/records/leads").send({ title: "x", data: { instagram: "http://insecure.test" } }).expect(400);
    await admin.post("/api/admin/records/leads").send({ title: "x", data: { businessType: "Spaceship" } }).expect(400);
    await admin.post("/api/admin/records/leads").send({ title: "x", data: { evil: 1 } }).expect(400);
    // Audit scores still go up to 10.
    const audit = await admin.post("/api/admin/records/audits").send({ title: "Brand audit", clientId: s.a.id, data: { auditType: "Brand", scoreStrategy: 9 } }).expect(201);
    expect(audit.body.data.overall).toBe(9);
  });

  it("converts a lead into a client", async () => {
    const lead = (await admin.post("/api/admin/records/leads").send({ title: "Fynbos Café", amount: 8000, data: { interest: "Branding" } }).expect(201)).body;
    const res = await admin.post(`/api/admin/records/leads/${lead.id}/actions/convertLead`).send({}).expect(200);
    expect(res.body.clientSlug).toBe("fynbos-cafe");
    const cs = await ctx.db.select().from(clients);
    expect(cs.map((c) => c.slug)).toContain("fynbos-cafe");
    await admin.post(`/api/admin/records/leads/${lead.id}/actions/convertLead`).send({}).expect(409);
    expect((await admin.get("/api/admin/records/leads")).body[0].status).toBe("WON");
  });

  it("feeds dated work into the agency calendar", async () => {
    await admin.post("/api/admin/records/websites").send({ title: "Site", clientId: s.a.id, date: iso(3), data: { url: "https://x.test" } }).expect(201);
    await admin.post("/api/admin/records/resources").send({ title: "Undated" }).expect(201);
    const res = await admin.get(`/api/admin/records/agenda?from=${iso(0)}&to=${iso(10)}`).expect(200);
    expect(res.body.map((x: any) => x.title)).toEqual(["Site"]);
    await admin.get("/api/admin/records/agenda").expect(400);
  });

  it("removes a client's records with the client", async () => {
    await admin.post("/api/admin/records/projects").send({ title: "P", clientId: s.b.id }).expect(201);
    await ctx.db.delete(clients).where((await import("drizzle-orm")).eq(clients.id, s.b.id));
    expect((await admin.get("/api/admin/records/projects")).body).toHaveLength(0);
  });

  it("gives every new to-do a date and shows it on the calendar feed", async () => {
    const res = await admin.post("/api/c/alpha-co/tasks").send({ title: "Undated" }).expect(201);
    expect(res.body.dueDate).toBe(iso(0));
    const feed = (await admin.get(`/api/admin/records/agenda?from=${iso(-1)}&to=${iso(1)}`).expect(200)).body;
    expect(feed.some((x: any) => x.kind === "task" && x.title === "Undated")).toBe(true);
  });

  it("summarises invoices for the dashboard tracker, ignoring quotes and expenses", async () => {
    const send = (b: object) => admin.post("/api/admin/records/finance").send({ clientId: s.a.id, ...b }).expect(201);
    await send({ title: "Late", amount: 1000, status: "SENT", date: iso(-5), data: { docType: "Invoice", number: "INV-1" } });
    await send({ title: "Soon", amount: 500, status: "SENT", date: iso(3), data: { docType: "Invoice" } });
    await send({ title: "Paid", amount: 250, status: "PAID", date: iso(-1), data: { docType: "Invoice", paidDate: iso(0) } });
    await send({ title: "A quote", amount: 9999, status: "SENT", date: iso(-9), data: { docType: "Quote" } });
    await send({ title: "Draft", amount: 70, status: "DRAFT", data: { docType: "Invoice" } });
    const t = (await admin.get("/api/admin/records/finance/tracker").expect(200)).body;
    expect(t.overdue).toBe(1000);
    expect(t.overdueCount).toBe(1);
    expect(t.outstanding).toBe(1500);
    expect(t.dueSoon).toBe(500);
    expect(t.draftCount).toBe(1);
    expect(t.watch[0].title).toBe("Late");
    expect(t.watch[0].daysLate).toBe(5);
    await request(ctx.app).get("/api/admin/records/finance/tracker").expect(401);
  });

  it("keeps task status, done, priority and subtasks consistent", async () => {
    const c = (await admin.post("/api/c/alpha-co/tasks").send({ title: "Plan", priority: "HIGH", subtasks: [{ id: "a", title: "Draft", done: false }] }).expect(201)).body;
    expect(c.status).toBe("TODO");
    expect(c.priority).toBe("HIGH");
    const doing = (await admin.patch(`/api/c/alpha-co/tasks/${c.id}`).send({ status: "DOING" }).expect(200)).body;
    expect(doing.done).toBe(false);
    const done = (await admin.patch(`/api/c/alpha-co/tasks/${c.id}`).send({ status: "DONE" }).expect(200)).body;
    expect(done.done).toBe(true);
    const reopened = (await admin.patch(`/api/c/alpha-co/tasks/${c.id}`).send({ done: false }).expect(200)).body;
    expect(reopened.status).toBe("TODO");
    const ticked = (await admin.patch(`/api/c/alpha-co/tasks/${c.id}`).send({ done: true }).expect(200)).body;
    expect(ticked.status).toBe("DONE");
    await admin.patch(`/api/c/alpha-co/tasks/${c.id}`).send({ priority: "SOON" }).expect(400);
    const all = (await admin.get("/api/admin/tasks").expect(200)).body;
    expect(all[0].subtasks).toHaveLength(1);
  });
});
