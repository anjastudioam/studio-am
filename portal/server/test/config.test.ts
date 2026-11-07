import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base = { NODE_ENV: "production", DATABASE_URL: "postgres://x", BASE_URL: "https://example.com" };

describe("production config", () => {
  it("starts without an email provider (password sign-in)", () => {
    expect(loadConfig(base).NODE_ENV).toBe("production");
  });
  it("requires https", () => {
    expect(() => loadConfig({ ...base, BASE_URL: "http://example.com" })).toThrow(/https/);
  });
  it("rejects a short admin password", () => {
    expect(() => loadConfig({ ...base, ADMIN_PASSWORD: "short" })).toThrow(/ADMIN_PASSWORD/);
  });
});
