import { eq } from "drizzle-orm";
import { hashPassword } from "./auth/password";
import { normaliseEmail } from "./auth/service";
import type { Db } from "./db";
import { users } from "./db/schema";

/**
 * Makes sure the first admin exists. Admins are never created through the public API.
 * If ADMIN_PASSWORD is set, it becomes that account's password, but only while the account has none.
 */
export async function ensureAdmin(db: Db, email: string | undefined, name: string, password?: string): Promise<void> {
  if (!email) return;
  const e = normaliseEmail(email);
  const [existing] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  const passwordHash = password ? await hashPassword(password) : undefined;
  if (!existing) {
    await db.insert(users).values({ email: e, name, role: "ADMIN", passwordHash });
    return;
  }
  if (passwordHash && !existing.passwordHash) await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));
}
