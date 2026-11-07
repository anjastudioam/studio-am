import { Router } from "express";
import { count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import { MIN_PASSWORD_LENGTH } from "../auth/password";
import { AuthService, normaliseEmail } from "../auth/service";
import type { Db } from "../db";
import { auditLog, clients, posts, records, tasks, users } from "../db/schema";
import { ne } from "drizzle-orm";
import { HttpError, isUuid, isoDate, wrap } from "../http";
import { seedDemo } from "../db/seed-demo";
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
        .where(inArray(posts.status, ["AWAITING_APPROVAL", "INTERNAL_REVIEW"]))
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

  /** Every to-do for every non-archived client, for the dashboard. */
  r.get(
    "/tasks",
    wrap(async (_req, res) => {
      const rows = await db
        .select({
          id: tasks.id,
          clientId: tasks.clientId,
          clientName: clients.name,
          clientSlug: clients.slug,
          title: tasks.title,
          dueDate: tasks.dueDate,
          owner: tasks.owner,
          priority: tasks.priority,
          status: tasks.status,
          notes: tasks.notes,
          subtasks: tasks.subtasks,
          done: tasks.done,
        })
        .from(tasks)
        .innerJoin(clients, eq(clients.id, tasks.clientId))
        .where(ne(clients.status, "ARCHIVED"))
        .orderBy(tasks.done, tasks.dueDate, clients.name);
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
      const [row] = await db.insert(clients).values({ name: parsed.data.name, slug, status: "ONBOARDING" }).returning();
      await audit(db, { actorUserId: req.user!.id, clientId: row.id, action: "client.create", entity: "client", entityId: row.id });
      res.status(201).json(row);
    }),
  );

  r.patch(
    "/clients/:id",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const t = (n: number) => z.string().trim().max(n).nullish();
      const profileSchema = z
        .object({
          contactName: t(120), email: t(200), phone: t(60), website: t(300), industry: t(120), address: t(300),
          services: z.array(z.string().trim().min(1).max(60)).max(20).nullish(),
          monthlyFee: z.number().min(0).max(1e9).nullish(),
          contractStart: isoDate.nullish(), contractEnd: isoDate.nullish(),
          notes: t(4000),
        })
        .strict();
      const parsed = z
        .object({ name: z.string().trim().min(1).max(120), status: z.enum(["ACTIVE", "ONBOARDING", "PAUSED", "ARCHIVED"]), profile: profileSchema })
        .partial()
        .strict()
        .safeParse(req.body);
      if (!parsed.success || Object.keys(parsed.data).length === 0) throw new HttpError(400, "Invalid input");
      const { profile, ...rest } = parsed.data;
      const set: Record<string, unknown> = { ...rest };
      if (profile) {
        const [cur] = await db.select({ profile: clients.profile }).from(clients).where(eq(clients.id, id)).limit(1);
        if (!cur) throw new HttpError(404, "Not found");
        const merged: Record<string, unknown> = { ...(cur.profile as Record<string, unknown>) };
        for (const [k, v] of Object.entries(profile)) {
          if (v === null || v === "" || (Array.isArray(v) && !v.length)) delete merged[k];
          else merged[k] = v;
        }
        set.profile = merged;
      }
      const [row] = await db.update(clients).set(set).where(eq(clients.id, id)).returning();
      if (!row) throw new HttpError(404, "Not found");
      await audit(db, { actorUserId: req.user!.id, clientId: id, action: "client.update", entity: "client", entityId: id });
      res.json(row);
    }),
  );

  // ---- Demo data: fictional clients that can be loaded or removed in one click ----
  r.get(
    "/demo-data",
    wrap(async (_req, res) => {
      const [{ n }] = await db.select({ n: count() }).from(clients).where(eq(clients.isDemo, true));
      res.json({ loaded: n > 0, clients: n });
    }),
  );
  r.post(
    "/demo-data",
    wrap(async (req, res) => {
      const created = await seedDemo(db, req.user!.id);
      if (created) await audit(db, { actorUserId: req.user!.id, action: "demo.load" });
      res.status(created ? 201 : 200).json({ loaded: true });
    }),
  );
  r.delete(
    "/demo-data",
    wrap(async (req, res) => {
      // Every client-owned table cascades from clients, so this removes all demo content.
      const removed = await db.delete(clients).where(eq(clients.isDemo, true)).returning({ id: clients.id });
      await db.delete(records).where(eq(records.isDemo, true)); // agency-wide sample rows (leads, resources, ...)
      await audit(db, { actorUserId: req.user!.id, action: "demo.remove" });
      res.json({ removed: removed.length });
    }),
  );

  // ---- Team: the people who can sign in to Studio AM (admins) ----
  const teamShape = (u: typeof users.$inferSelect) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    active: u.active,
    hasPassword: !!u.passwordHash,
    lastLoginAt: u.lastLoginAt,
  });
  const passwordField = z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`).max(200);

  r.get(
    "/team",
    wrap(async (_req, res) => {
      const rows = await db.select().from(users).where(eq(users.role, "ADMIN")).orderBy(users.name);
      res.json(rows.map(teamShape));
    }),
  );

  r.post(
    "/team",
    wrap(async (req, res) => {
      const parsed = z
        .object({ email: z.string().trim().email().max(254), name: z.string().trim().min(1).max(120), password: passwordField })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
      const email = normaliseEmail(parsed.data.email);
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (exists) throw new HttpError(409, "That email is already registered");
      const [row] = await db.insert(users).values({ email, name: parsed.data.name, role: "ADMIN" }).returning();
      await auth.setPassword(row.id, parsed.data.password);
      await audit(db, { actorUserId: req.user!.id, action: "team.add", entity: "user", entityId: row.id });
      const [fresh] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
      res.status(201).json(teamShape(fresh));
    }),
  );

  r.patch(
    "/team/:id",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const parsed = z.object({ password: passwordField.optional(), active: z.boolean().optional() }).strict().safeParse(req.body);
      if (!parsed.success || Object.keys(parsed.data).length === 0)
        throw new HttpError(400, parsed.success ? "Nothing to change" : (parsed.error.issues[0]?.message ?? "Invalid input"));
      const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!target || target.role !== "ADMIN") throw new HttpError(404, "Not found");
      if (parsed.data.active === false && id === req.user!.id) throw new HttpError(400, "You can't deactivate yourself");

      if (parsed.data.active !== undefined) {
        await db.update(users).set({ active: parsed.data.active }).where(eq(users.id, id));
        if (!parsed.data.active) await auth.revokeAllSessions(id);
      }
      if (parsed.data.password) {
        await auth.setPassword(id, parsed.data.password, id === req.user!.id ? req.sessionToken : undefined);
        await audit(db, { actorUserId: req.user!.id, action: "team.password_reset", entity: "user", entityId: id });
      }
      const [fresh] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      res.json(teamShape(fresh));
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

