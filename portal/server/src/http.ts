import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import type { ClientScope } from "./scope/clientScope";
import type { SessionUser } from "./auth/service";

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
    sessionToken?: string;
    scope?: ClientScope;
    client?: { id: string; name: string; slug: string; status: string };
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps async handlers so rejected promises reach the error handler (Express 4 does not do this itself). */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const uuidSchema = z.string().uuid();

export function isUuid(v: unknown): v is string {
  return uuidSchema.safeParse(v).success;
}

export const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((u) => {
    try {
      return new URL(u).protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid https:// link");

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
