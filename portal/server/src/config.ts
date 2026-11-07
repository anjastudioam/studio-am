import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_NAME: z.string().default("Studio AM Admin"),
  RESEND_API_KEY: z.string().optional(),
  // Optional first password for the ADMIN_EMAIL account (min 12 chars). Applied only while that account has no password; remove it afterwards.
  ADMIN_PASSWORD: z.string().min(12).max(200).optional(),
  MAIL_FROM: z.string().default("Studio AM <portal@studio-am.co.za>"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === "production") {
    if (!cfg.BASE_URL.startsWith("https://")) throw new Error("BASE_URL must be https in production");
  }
  return cfg;
}
