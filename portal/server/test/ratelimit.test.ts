import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reset, seedBasics, setup } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => {
  ctx = await setup({ rateLimit: true });
  await reset(ctx.db);
  await seedBasics(ctx.db);
});
afterAll(async () => {
  await ctx.pool.end();
});

describe("rate limiting", () => {
  it("throttles repeated sign-in requests from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(ctx.app).post("/api/auth/request").send({ email: `nobody${i}@x.test` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 202)).toBe(true);
    expect(statuses).toContain(429);
  });
});
