import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const base = { NODE_ENV: "production", DATABASE_URL: "postgres://x", BASE_URL: "https://example.com" };

describe("production config", () => {
  it("requires an email provider by default", () => {
    expect(() => loadConfig(base)).toThrow(/RESEND_API_KEY/);
  });
  it("allows demo mode without an email provider", () => {
    expect(loadConfig({ ...base, DEMO_MODE: "true" }).DEMO_MODE).toBe("true");
  });
  it("still requires https in demo mode", () => {
    expect(() => loadConfig({ ...base, DEMO_MODE: "true", BASE_URL: "http://example.com" })).toThrow(/https/);
  });
});
