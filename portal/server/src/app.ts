import path from "node:path";
import fs from "node:fs";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AuthService } from "./auth/service";
import type { Config } from "./config";
import type { Db } from "./db";
import { HttpError } from "./http";
import type { Mailer } from "./mail/mailer";
import { originCheck, sessionLoader } from "./middleware/auth";
import { adminRoutes } from "./routes/admin";
import { recordRoutes } from "./routes/records";
import { authRoutes } from "./routes/auth";
import { portalRoutes } from "./routes/portal";

export type AppDeps = {
  cfg: Config;
  db: Db;
  mailer: Mailer;
  /** Turn off in tests that are not about rate limiting. */
  rateLimit?: boolean;
  /** Folder with the built client app (optional). */
  clientDir?: string;
};

export function createApp(deps: AppDeps) {
  const { cfg, db, mailer } = deps;
  const production = cfg.NODE_ENV === "production";
  const limitsOn = deps.rateLimit ?? true;
  const auth = new AuthService(db, mailer, cfg);

  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      referrerPolicy: { policy: "same-origin" },
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  if (limitsOn) api.use(rateLimit({ windowMs: 60_000, limit: 900, standardHeaders: true, legacyHeaders: false }));
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  api.use(originCheck(cfg.BASE_URL));
  api.use(sessionLoader(auth, production));
  api.use("/auth", authRoutes({ db, auth, production, rateLimit: limitsOn }));
  api.use("/admin/records", recordRoutes({ db }));
  api.use("/admin", adminRoutes({ db, auth }));
  api.use("/c/:slug", portalRoutes({ db }));
  api.use((_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use("/api", api);

  // Built client app (single-page app) when present.
  const clientDir = deps.clientDir;
  if (clientDir && fs.existsSync(path.join(clientDir, "index.html"))) {
    app.use(
      express.static(clientDir, {
        index: false,
        maxAge: "1h",
        // The service worker and manifest must always be re-checked so app updates reach installed copies.
        setHeaders: (res, file) => {
          if (/(sw\.js|manifest\.webmanifest)$/.test(file)) res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, ...((err as any).issues ? { issues: (err as any).issues } : {}) });
    }
    if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
      return res.status(err.status ?? 400).json({ error: "Invalid request body" });
    }
    console.error("Unhandled error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
