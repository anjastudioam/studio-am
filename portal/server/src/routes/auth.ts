import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { audit } from "../audit";
import type { AuthService } from "../auth/service";
import { MIN_PASSWORD_LENGTH } from "../auth/password";
import type { Db } from "../db";
import { clients } from "../db/schema";
import { eq } from "drizzle-orm";
import { HttpError, wrap } from "../http";
import { requireAuth, SESSION_COOKIE, sessionCookieOptions } from "../middleware/auth";

export function authRoutes(opts: { db: Db; auth: AuthService; production: boolean; rateLimit: boolean }) {
  const r = Router();
  const { db, auth } = opts;

  const limiter = (max: number) =>
    opts.rateLimit
      ? rateLimit({ windowMs: 15 * 60_000, limit: max, standardHeaders: true, legacyHeaders: false })
      : (_req: any, _res: any, next: any) => next();

  const emailBody = z.object({ email: z.string().trim().email().max(254) }).strict();
  const verifyBody = z.object({ token: z.string().min(20).max(200) }).strict();

  // Always answers the same way, whether or not the email is known.
  r.post(
    "/request",
    limiter(8),
    wrap(async (req, res) => {
      const parsed = emailBody.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "Enter a valid email address");
      try {
        await auth.requestLogin(parsed.data.email);
      } catch (e) {
        console.error("login request failed", e instanceof Error ? e.message : e);
      }
      res.status(202).json({ ok: true });
    }),
  );

  r.post(
    "/verify",
    limiter(20),
    wrap(async (req, res) => {
      const parsed = verifyBody.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "Invalid link");
      const result = await auth.verifyLogin(parsed.data.token, req.get("user-agent") ?? undefined);
      if (!result) throw new HttpError(400, "This sign-in link has expired or was already used. Request a new one.");

      res.cookie(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(opts.production));
      await audit(db, { actorUserId: result.user.id, clientId: result.user.clientId, action: "auth.login" });
      res.json({ user: result.user });
    }),
  );

  const loginBody = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) }).strict();

  r.post(
    "/login",
    limiter(20),
    wrap(async (req, res) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "Enter your email and password");
      const result = await auth.loginWithPassword(parsed.data.email, parsed.data.password, req.get("user-agent") ?? undefined);
      if (!result) throw new HttpError(401, "That email and password don't match. Check them and try again.");
      res.cookie(SESSION_COOKIE, result.sessionToken, sessionCookieOptions(opts.production));
      await audit(db, { actorUserId: result.user.id, clientId: result.user.clientId, action: "auth.login" });
      res.json({ user: result.user });
    }),
  );

  const passwordBody = z
    .object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(200) })
    .strict();

  r.post(
    "/password",
    requireAuth,
    limiter(10),
    wrap(async (req, res) => {
      const parsed = passwordBody.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, `The new password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      if (!(await auth.checkPassword(req.user!.id, parsed.data.currentPassword)))
        throw new HttpError(400, "Your current password is not correct");
      await auth.setPassword(req.user!.id, parsed.data.newPassword, req.sessionToken);
      await audit(db, { actorUserId: req.user!.id, action: "user.password_change", entity: "user", entityId: req.user!.id });
      res.json({ ok: true });
    }),
  );

  r.post(
    "/logout",
    wrap(async (req, res) => {
      if (req.sessionToken) await auth.logout(req.sessionToken);
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.json({ ok: true });
    }),
  );

  r.get(
    "/me",
    requireAuth,
    wrap(async (req, res) => {
      const user = req.user!;
      let client = null;
      if (user.clientId) {
        const [c] = await db.select().from(clients).where(eq(clients.id, user.clientId)).limit(1);
        if (c) client = { id: c.id, name: c.name, slug: c.slug };
      }
      res.json({ user, client });
    }),
  );

  return r;
}
