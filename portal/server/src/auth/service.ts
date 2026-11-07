import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db";
import { loginTokens, sessions, users } from "../db/schema";
import type { Mailer } from "../mail/mailer";
import { loginEmail } from "../mail/templates";
import { hashToken, newToken } from "./tokens";

export const LOGIN_TOKEN_MINUTES = 15;
export const SESSION_DAYS = 14;
const MAX_LOGIN_EMAILS_PER_HOUR = 5;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CLIENT";
  clientId: string | null;
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class AuthService {
  constructor(
    private db: Db,
    private mailer: Mailer,
    private cfg: Pick<Config, "BASE_URL">,
  ) {}

  /**
   * Sends a sign-in link if the email belongs to an active user.
   * Deliberately returns nothing: the caller must respond identically either way,
   * so email addresses cannot be probed.
   */
  async requestLogin(rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.active) return;

    const [{ n }] = await this.db
      .select({ n: count() })
      .from(loginTokens)
      .where(and(eq(loginTokens.userId, user.id), gt(loginTokens.createdAt, sql`now() - interval '1 hour'`)));
    if (n >= MAX_LOGIN_EMAILS_PER_HOUR) return;

    const token = newToken();
    await this.db.insert(loginTokens).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60_000),
    });

    const link = `${this.cfg.BASE_URL}/auth/verify#token=${token}`;
    await this.mailer.send(loginEmail(user.email, user.name, link));
  }

  /** Exchanges a single-use login token for a session. Returns null if invalid, used or expired. */
  async verifyLogin(token: string, userAgent?: string): Promise<{ sessionToken: string; user: SessionUser } | null> {
    // One atomic statement: marks the token used only if it is still unused and unexpired.
    const claimed = await this.db
      .update(loginTokens)
      .set({ usedAt: new Date() })
      .where(
        and(eq(loginTokens.tokenHash, hashToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, new Date())),
      )
      .returning({ userId: loginTokens.userId });
    if (claimed.length === 0) return null;

    const [user] = await this.db.select().from(users).where(eq(users.id, claimed[0].userId)).limit(1);
    if (!user || !user.active) return null;

    const sessionToken = newToken();
    await this.db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      userAgent: userAgent?.slice(0, 300),
    });
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    return { sessionToken, user: toSessionUser(user) };
  }

  async getSessionUser(sessionToken: string): Promise<SessionUser | null> {
    const rows = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(sessionToken)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const user = rows[0]?.user;
    if (!user || !user.active) return null;
    return toSessionUser(user);
  }

  async logout(sessionToken: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(sessionToken)));
  }

  /** Signs a user out everywhere (used when an account is deactivated). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

function toSessionUser(u: typeof users.$inferSelect): SessionUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, clientId: u.clientId };
}
