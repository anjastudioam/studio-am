import { Router } from "express";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import { AuthService, normaliseEmail } from "../auth/service";
import type { Db } from "../db";
import { auditLog, clients, posts, tasks, users } from "../db/schema";
import { ne } from "drizzle-orm";
import { HttpError, isUuid, wrap } from "../http";
import { requireAdmin } from "../middleware/auth";

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "client";
}

export function adminRoutes(opts: { db: Db; auth: AuthService }) {
  const { db, auth } = opts;
  const r = Router();
  r.use(requireAdmin);

  r.get(
    "/clients",
    wrap(async (_req, res) => {
      const all = await db.select().from(clients).orderBy(clients.name);
      const awaiting = await db
        .select({ clientId: posts.clientId, n: count() })
        .from(posts)
        .where(eq(posts.status, "AWAITING_APPROVAL"))
        .groupBy(posts.clientId);
      const open = await db
        .select({ clientId: tasks.clientId, n: count() })
        .from(tasks)
        .where(eq(tasks.done, false))
        .groupBy(tasks.clientId);
      const aw = new Map(awaiting.map((a) => [a.clientId, a.n]));
      const op = new Map(open.map((a) => [a.clientId, a.n]));
      res.json(all.map((c) => ({ ...c, awaitingApproval: aw.get(c.id) ?? 0, openTasks: op.get(c.id) ?? 0 })));
    }),
  );

  /** Master calendar: every post for every non-archived client, newest information first by date. */
  r.get(
    "/posts",
    wrap(async (_req, res) => {
      const rows = await db
        .select({
          id: posts.id,
          clientId: posts.clientId,
          clientName: clients.name,
          clientSlug: clients.slug,
          publishDate: posts.publishDate,
          platform: posts.platform,
          pillar: posts.pillar,
          format: posts.format,
          caption: posts.caption,
          assetUrl: posts.assetUrl,
          status: posts.status,
          internalNote: posts.internalNote,
        })
        .from(posts)
        .innerJoin(clients, eq(clients.id, posts.clientId))
        .where(ne(clients.status, "ARCHIVED"))
        .orderBy(posts.publishDate, clients.name);
      res.json(rows);
    }),
  );

  r.post(
    "/clients",
    wrap(async (req, res) => {
      const parsed = z.object({ name: z.string().trim().min(1).max(120) }).strict().safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "A client name is required");

      const base = slugify(parsed.data.name);
      let slug = base;
      for (let i = 2; ; i++) {
        const [hit] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug)).limit(1);
        if (!hit) break;
        slug = `${base}-${i}`;
      }
      const [row] = await db.insert(clients).values({ name: parsed.data.name, slug }).returning();
      await audit(db, { actorUserId: req.user!.id, clientId: row.id, action: "client.create", entity: "client", entityId: row.id });
      res.status(201).json(row);
    }),
  );

  r.patch(
    "/clients/:id",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const parsed = z
        .object({ name: z.string().trim().min(1).max(120), status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]) })
        .partial()
        .strict()
        .safeParse(req.body);
      if (!parsed.success || Object.keys(parsed.data).length === 0) throw new HttpError(400, "Invalid input");
      const [row] = await db.update(clients).set(parsed.data).where(eq(clients.id, id)).returning();
      if (!row) throw new HttpError(404, "Not found");
      await audit(db, { actorUserId: req.user!.id, clientId: id, action: "client.update", entity: "client", entityId: id });
      res.json(row);
    }),
  );

  r.get(
    "/clients/:id/users",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const rows = await db.select().from(users).where(eq(users.clientId, id)).orderBy(users.name);
      res.json(rows);
    }),
  );

  r.post(
    "/clients/:id/users",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const parsed = z
        .object({ email: z.string().trim().email().max(254), name: z.string().trim().min(1).max(120), sendInvite: z.boolean().optional() })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "A name and a valid email are required");

      const [client] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
      if (!client) throw new HttpError(404, "Not found");

      const email = normaliseEmail(parsed.data.email);
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (exists) throw new HttpError(409, "That email is already registered");

      const [row] = await db
        .insert(users)
        .values({ email, name: parsed.data.name, role: "CLIENT", clientId: id })
        .returning();
      await audit(db, { actorUserId: req.user!.id, clientId: id, action: "user.invite", entity: "user", entityId: row.id });
      if (parsed.data.sendInvite) await auth.requestLogin(email);
      res.status(201).json(row);
    }),
  );

  r.patch(
    "/users/:id",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const parsed = z.object({ active: z.boolean() }).strict().safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, "Invalid input");
      if (id === req.user!.id && !parsed.data.active) throw new HttpError(400, "You can't deactivate yourself");

      const [row] = await db.update(users).set({ active: parsed.data.active }).where(eq(users.id, id)).returning();
      if (!row) throw new HttpError(404, "Not found");
      if (!parsed.data.active) await auth.revokeAllSessions(id);
      await audit(db, {
        actorUserId: req.user!.id,
        clientId: row.clientId,
        action: parsed.data.active ? "user.activate" : "user.deactivate",
        entity: "user",
        entityId: id,
      });
      res.json(row);
    }),
  );

  r.get(
    "/audit",
    wrap(async (req, res) => {
      const clientId = req.query.clientId ? String(req.query.clientId) : null;
      if (clientId && !isUuid(clientId)) throw new HttpError(400, "Invalid client");
      const rows = await db
        .select()
        .from(auditLog)
        .where(clientId ? eq(auditLog.clientId, clientId) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(200);
      res.json(rows);
    }),
  );

  return r;
}

