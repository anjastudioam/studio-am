import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clients, records, tasks, timeEntries } from "../src/db/schema";
import { runRecurring } from "../src/jobs/recurring";
import { healthOf } from "../src/routes/time";
import { addDays, nextMonthly, todayZA } from "../src/util/dates";
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
  s = await seedBasics(ctx.db);
  admin = await signIn(ctx, "admin@studio.test");
});

const today = () => todayZA();

describe("date helpers", () => {
  it("moves monthly dates without drifting", () => {
    expect(nextMonthly("2026-01-31", 0)).toBe("2026-02-28");
    expect(nextMonthly("2026-02-28", 0)).toBe("2026-03-31");
    expect(nextMonthly("2026-12-05", 5)).toBe("2027-01-05");
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
  });
});

describe("recurring work", () => {
  const rule = (b: object) => admin.post("/api/admin/records/recurring").send({ clientId: s.a.id, ...b });

  it("needs a client and a first run date", async () => {
    await rule({ title: "X", data: { kind: "To-do", frequency: "Weekly" } }).expect(400);
    await admin.post("/api/admin/records/recurring").send({ title: "X", date: today(), data: { kind: "To-do", frequency: "Weekly" } }).expect(400);
  });

  it("creates a due to-do straight away and moves the rule on", async () => {
    const res = await rule({ title: "Monthly report: {month}", date: today(), data: { kind: "To-do", frequency: "Monthly", monthDay: "Last day", priority: "High" } }).expect(201);
    const made = await ctx.db.select().from(tasks);
    expect(made).toHaveLength(1);
    expect(made[0].title).toMatch(/^Monthly report: \w+ \d{4}$/);
    expect(made[0].tag).toBe("recurring");
    expect(made[0].priority).toBe("HIGH");
    expect(made[0].dueDate).toBe(today());
    const after = (await admin.get("/api/admin/records/recurring").expect(200)).body[0];
    expect(after.date > today()).toBe(true);
    expect(after.data.lastRun).toBe(today());
    // Running again must not duplicate anything.
    expect(await runRecurring(ctx.db)).toEqual({ rules: 0, created: 0 });
    expect(await ctx.db.select().from(tasks)).toHaveLength(1);
    expect(res.body.id).toBe(after.id);
  });

  it("catches up on missed runs, but only the latest few", async () => {
    await rule({ title: "Weekly plan", date: addDays(today(), -70), data: { kind: "To-do", frequency: "Weekly" } }).expect(201);
    expect(await ctx.db.select().from(tasks)).toHaveLength(3);
  });

  it("creates a draft invoice from the rule amount, or the client's monthly fee", async () => {
    await ctx.db.update(clients).set({ profile: { monthlyFee: 7500 } }).where(eq(clients.id, s.a.id));
    await rule({ title: "Retainer {month}", date: today(), data: { kind: "Invoice", frequency: "Monthly", monthDay: "1", terms: "14 days" } }).expect(201);
    const inv = (await admin.get("/api/admin/records/finance").expect(200)).body;
    expect(inv).toHaveLength(1);
    expect(inv[0].status).toBe("DRAFT");
    expect(inv[0].amount).toBe(7500);
    expect(inv[0].date).toBe(addDays(today(), 14));
    expect(inv[0].data.docType).toBe("Retainer");
  });

  it("skips paused rules and can be run on demand", async () => {
    const r = (await rule({ title: "Paused", status: "PAUSED", date: today(), data: { kind: "To-do", frequency: "Weekly" } }).expect(201)).body;
    expect(await ctx.db.select().from(tasks)).toHaveLength(0);
    await admin.patch(`/api/admin/records/recurring/${r.id}`).send({ status: "ACTIVE" }).expect(200);
    expect(await ctx.db.select().from(tasks)).toHaveLength(1);
    const out = (await admin.post("/api/admin/records/recurring/run").expect(200)).body;
    expect(out.created).toBe(0);
  });
});

describe("time tracking", () => {
  it("runs one timer at a time and logs minutes when stopped", async () => {
    await admin.post("/api/admin/time/start").send({ clientId: s.a.id, note: "Design" }).expect(201);
    let run = (await admin.get("/api/admin/time/running").expect(200)).body.running;
    expect(run.clientId).toBe(s.a.id);
    await admin.post("/api/admin/time/start").send({ clientId: s.b.id }).expect(201); // stops the first one
    run = (await admin.get("/api/admin/time/running").expect(200)).body.running;
    expect(run.clientId).toBe(s.b.id);
    const rows = await ctx.db.select().from(timeEntries);
    expect(rows.filter((x) => x.minutes === null)).toHaveLength(1);
    expect(rows.find((x) => x.clientId === s.a.id)!.minutes).toBeGreaterThanOrEqual(1);
    await admin.post("/api/admin/time/stop").expect(200);
    await admin.post("/api/admin/time/stop").expect(409);
    expect((await admin.get("/api/admin/time/running")).body.running).toBeNull();
  });

  it("adds, edits and deletes manual entries with validation", async () => {
    await admin.post("/api/admin/time/entries").send({ clientId: s.a.id, date: today(), minutes: 0 }).expect(400);
    await admin.post("/api/admin/time/entries").send({ clientId: s.a.id, date: today(), minutes: 5000 }).expect(400);
    const e = (await admin.post("/api/admin/time/entries").send({ clientId: s.a.id, date: today(), minutes: 90, note: "Calls" }).expect(201)).body;
    await admin.patch(`/api/admin/time/entries/${e.id}`).send({ minutes: 120 }).expect(200);
    const list = (await admin.get("/api/admin/time/entries").expect(200)).body;
    expect(list[0].minutes).toBe(120);
    await admin.delete(`/api/admin/time/entries/${e.id}`).expect(204);
    await admin.delete(`/api/admin/time/entries/${e.id}`).expect(404);
    await request(ctx.app).get("/api/admin/time/summary").expect(401);
  });

  it("works out what each hour of a retainer earned", async () => {
    await ctx.db.update(clients).set({ profile: { monthlyFee: 6000 } }).where(eq(clients.id, s.a.id));
    await admin.post("/api/admin/time/entries").send({ clientId: s.a.id, date: today(), minutes: 600 }).expect(201); // 10 hours
    await admin.put("/api/admin/time/target").send({ rate: 800 }).expect(200);
    const sum = (await admin.get("/api/admin/time/summary").expect(200)).body;
    const row = sum.rows.find((x: any) => x.clientId === s.a.id);
    expect(row.rate).toBe(600);
    expect(row.health).toBe("watch");
    expect(row.gap).toBe(-2000);
    expect(sum.target).toBe(800);
  });

  it("classifies retainer health", () => {
    expect(healthOf(null, 60, 500).health).toBe("no-fee");
    expect(healthOf(5000, 0, 500).health).toBe("no-time");
    expect(healthOf(5000, 600, null).health).toBe("no-target");
    expect(healthOf(5000, 600, 400).health).toBe("ok"); // R500/h
    expect(healthOf(5000, 600, 600).health).toBe("watch"); // R500/h vs R600 target
    expect(healthOf(5000, 1200, 800).health).toBe("loss"); // R250/h
  });
});

describe("client onboarding", () => {
  it("creates the standard tasks, questionnaire and kick-off once", async () => {
    await admin.post(`/api/admin/onboarding/${s.a.id}`).send({}).expect(201);
    const t = await ctx.db.select().from(tasks);
    expect(t.length).toBeGreaterThanOrEqual(10);
    expect(t.every((x) => x.tag === "onboarding" && !!x.dueDate)).toBe(true);
    const meetings = await ctx.db.select().from(records).where(eq(records.module, "meetings"));
    expect(meetings.map((m) => m.title).some((x) => x.startsWith("Discovery questionnaire"))).toBe(true);
    expect(meetings.map((m) => m.title).some((x) => x.startsWith("Kick-off meeting"))).toBe(true);
    const [c] = await ctx.db.select().from(clients).where(eq(clients.id, s.a.id));
    expect(c.status).toBe("ONBOARDING");
    await admin.post(`/api/admin/onboarding/${s.a.id}`).send({}).expect(409);
    const p = (await admin.get(`/api/admin/onboarding/${s.a.id}`).expect(200)).body;
    expect(p.total).toBe(t.length);
    expect(p.done).toBe(0);
    expect(p.questionnaireId).toBeTruthy();
  });

  it("can also set up recurring work, including the retainer invoice when a fee is set", async () => {
    await ctx.db.update(clients).set({ profile: { monthlyFee: 5000 } }).where(eq(clients.id, s.b.id));
    await admin.post(`/api/admin/onboarding/${s.b.id}`).send({ recurring: true }).expect(201);
    const rules = (await admin.get("/api/admin/records/recurring").expect(200)).body;
    expect(rules).toHaveLength(3);
    expect(rules.some((r: any) => r.data.kind === "Invoice" && r.amount === 5000)).toBe(true);
  });

  it("rejects unknown clients and bad bodies", async () => {
    await admin.post("/api/admin/onboarding/not-a-uuid").send({}).expect(404);
    await admin.post(`/api/admin/onboarding/${s.a.id}`).send({ evil: 1 }).expect(400);
    await request(ctx.app).post(`/api/admin/onboarding/${s.a.id}`).send({}).expect(401);
  });
});
