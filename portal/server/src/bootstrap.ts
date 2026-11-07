import { eq } from "drizzle-orm";
import { normaliseEmail } from "./auth/service";
import type { Db } from "./db";
import { users } from "./db/schema";

/** Makes sure the first admin exists. Admins are never created through the public API. */
export async function ensureAdmin(db: Db, email: string | undefined, name: string): Promise<void> {
  if (!email) return;
  const e = normaliseEmail(email);
  const [existing] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (existing) return;
  await db.insert(users).values({ email: e, name, role: "ADMIN" });
}
