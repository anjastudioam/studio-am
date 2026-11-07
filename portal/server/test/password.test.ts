import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ensureAdmin } from "../src/bootstrap";
import { sessions, users } from "../src/db/schema";
import { reset, seedBasics, setup, signIn } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
const PW = "correct horse battery";

beforeAll(async () => {
  ctx = await setup();
});
afterAll(async () => {
  await ctx.pool.end();
});
beforeEach(async () => {
  await reset(ctx.db);
});

async function adminWithPassword() {
  const seed = await seedBasics(ctx.db);
  const admin = await signIn(ctx, "admin@studio.test");
  await ctx.db.update(users).set({ passwordHash: null }).where(eq(users.id, seed.admin.id));
  return { seed, admin };
}

describe("password sign-in", () => {
  it("team page creates an account that can sign in with its password", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "Wife@Studio.test", name: "Wife", password: PW }).expect(201);
    const agent = request.agent(ctx.app);
    const res = await agent.post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(200);
    expect(res.body.user.role).toBe("ADMIN");
    await agent.get("/api/admin/clients").expect(200);
    expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("answers the same for a wrong password and an unknown email", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    const a = await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: "wrong wrong wrong" });
    const b = await request(ctx.app).post("/api/auth/login").send({ email: "nobody@studio.test", password: "wrong wrong wrong" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it("locks the account for 15 minutes after 8 wrong passwords, even for the right password", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    for (let i = 0; i < 8; i++) await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: "nope nope nope" }).expect(401);
    await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(401);
  });

  it("rejects short passwords on the team page", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: "short" }).expect(400);
  });

  it("does not let signed-out visitors use the team endpoints", async () => {
    await request(ctx.app).get("/api/admin/team").expect(401);
    await request(ctx.app).post("/api/admin/team").send({ email: "x@y.test", name: "X", password: PW }).expect(401);
  });

  it("never returns password hashes", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    const res = await admin.get("/api/admin/team").expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|passwordHash/);
  });

  it("changing your own password needs the current one and signs out other devices", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    const tablet = request.agent(ctx.app);
    const laptop = request.agent(ctx.app);
    await tablet.post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(200);
    await laptop.post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(200);
    await tablet.post("/api/auth/password").send({ currentPassword: "wrong wrong wrong", newPassword: "a brand new phrase" }).expect(400);
    await tablet.post("/api/auth/password").send({ currentPassword: PW, newPassword: "a brand new phrase" }).expect(200);
    await tablet.get("/api/auth/me").expect(200);
    await laptop.get("/api/auth/me").expect(401);
    await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(401);
    await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: "a brand new phrase" }).expect(200);
  });

  it("resetting a password from the team page signs that person out", async () => {
    const { admin } = await adminWithPassword();
    const created = await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    const tablet = request.agent(ctx.app);
    await tablet.post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(200);
    await admin.patch(`/api/admin/team/${created.body.id}`).send({ password: "reset to something new" }).expect(200);
    await tablet.get("/api/auth/me").expect(401);
    await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: "reset to something new" }).expect(200);
  });

  it("a deactivated team member cannot sign in", async () => {
    const { admin } = await adminWithPassword();
    const created = await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    await admin.patch(`/api/admin/team/${created.body.id}`).send({ active: false }).expect(200);
    await request(ctx.app).post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(401);
  });

  it("keeps a regularly used session alive by extending it", async () => {
    const { admin } = await adminWithPassword();
    await admin.post("/api/admin/team").send({ email: "wife@studio.test", name: "Wife", password: PW }).expect(201);
    const agent = request.agent(ctx.app);
    await agent.post("/api/auth/login").send({ email: "wife@studio.test", password: PW }).expect(200);
    const soon = new Date(Date.now() + 10 * 86_400_000);
    await ctx.db.update(sessions).set({ expiresAt: soon });
    const res = await agent.get("/api/auth/me").expect(200);
    expect(res.headers["set-cookie"]?.[0]).toContain("sam_session");
    const rows = await ctx.db.select().from(sessions);
    expect(rows.filter((r) => r.expiresAt.getTime() > Date.now() + 170 * 86_400_000)).toHaveLength(1);
  });
});

describe("ensureAdmin with ADMIN_PASSWORD", () => {
  it("sets the password only while the account has none", async () => {
    await ensureAdmin(ctx.db, "boss@studio.test", "Boss", PW);
    await request(ctx.app).post("/api/auth/login").send({ email: "boss@studio.test", password: PW }).expect(200);
    await ensureAdmin(ctx.db, "boss@studio.test", "Boss", "some other long phrase");
    await request(ctx.app).post("/api/auth/login").send({ email: "boss@studio.test", password: "some other long phrase" }).expect(401);
    await request(ctx.app).post("/api/auth/login").send({ email: "boss@studio.test", password: PW }).expect(200);
  });
});
