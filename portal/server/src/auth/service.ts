import { and, count, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db";
import { loginTokens, sessions, users } from "../db/schema";
import type { Mailer } from "../mail/mailer";
import { loginEmail } from "../mail/templates";
import { dummyHash, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";
import { hashToken, newToken } from "./tokens";

export const LOGIN_TOKEN_MINUTES = 15;
export const SESSION_DAYS = 180;
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
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
    if (!user || !user.active || user.role !== "ADMIN") return;

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
    if (!user || !user.active || user.role !== "ADMIN") return null;

    const sessionToken = await this.startSession(user.id, userAgent);
    return { sessionToken, user: toSessionUser(user) };
  }

  private async startSession(userId: string, userAgent?: string): Promise<string> {
    const sessionToken = newToken();
    await this.db.insert(sessions).values({
      userId,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      userAgent: userAgent?.slice(0, 300),
    });
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
    return sessionToken;
  }

  /**
   * Email + password sign-in. Every failure returns null, so the caller answers identically
   * whether the email is unknown, the password is wrong or the account is locked.
   * After 8 wrong passwords in a row the account is locked for 15 minutes.
   */
  async loginWithPassword(
    rawEmail: string,
    password: string,
    userAgent?: string,
  ): Promise<{ sessionToken: string; user: SessionUser } | null> {
    const email = normaliseEmail(rawEmail);
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !user.active || user.role !== "ADMIN" || !user.passwordHash) {
      await verifyPassword(password, await dummyHash());
      return null;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) return null;

    if (!(await verifyPassword(password, user.passwordHash))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.db
        .update(users)
        .set({ failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
        .where(eq(users.id, user.id));
      return null;
    }
    await this.db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, user.id));
    const sessionToken = await this.startSession(user.id, userAgent);
    return { sessionToken, user: toSessionUser(user) };
  }

  /** Sets a password and signs the user out everywhere else. `keepSessionToken` keeps the caller's own session. */
  async setPassword(userId: string, password: string, keepSessionToken?: string): Promise<void> {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error("Password too short");
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, userId));
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), keepSessionToken ? ne(sessions.tokenHash, hashToken(keepSessionToken)) : undefined));
  }

  async checkPassword(userId: string, password: string): Promise<boolean> {
    const [u] = await this.db.select({ h: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
    return !!u?.h && verifyPassword(password, u.h);
  }

  /** Keeps a regularly used session alive: pushes expiry out again once it is a day old. Returns true if extended. */
  async renewSession(sessionToken: string): Promise<boolean> {
    const threshold = new Date(Date.now() + (SESSION_DAYS - 1) * 86_400_000);
    const rows = await this.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
      .where(and(eq(sessions.tokenHash, hashToken(sessionToken)), lt(sessions.expiresAt, threshold)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async getSessionUser(sessionToken: string): Promise<SessionUser | null> {
    const rows = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(sessionToken)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    const user = rows[0]?.user;
    // Studio AM is internal only: clients never have access, whatever is in the database.
    if (!user || !user.active || user.role !== "ADMIN") return null;
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
