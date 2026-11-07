import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../auth/service";
import { HttpError, wrap } from "../http";

export const SESSION_COOKIE = "sam_session";

export function sessionLoader(auth: AuthService) {
  return wrap(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token.length > 0) {
      const user = await auth.getSessionUser(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Not signed in"));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Not signed in"));
  if (req.user.role !== "ADMIN") return next(new HttpError(403, "Admins only"));
  next();
}

/**
 * Blocks cross-site writes. Browsers always send Origin on cross-site POST/PATCH/DELETE.
 * Requests with no Origin (curl, tests) are allowed: they cannot ride a victim's cookie.
 */
export function originCheck(baseUrl: string) {
  const allowed = new URL(baseUrl).origin;
  return (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (origin && origin !== allowed) return next(new HttpError(403, "Cross-site request blocked"));
    next();
  };
}
