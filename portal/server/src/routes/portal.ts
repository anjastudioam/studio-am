import { todayZA } from "../util/dates";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import type { Db } from "../db";
import { postEvents } from "../db/schema";
import { HttpError, httpsUrl, isUuid, isoDate, wrap } from "../http";
import { resolveClient } from "../middleware/clientScope";
import { requireAdmin } from "../middleware/auth";
import { ResourceName, Row } from "../scope/clientScope";

const linkTypes = [
  "SOCIAL_PROFILES",
  "GOOGLE_DRIVE",
  "MEETING_NOTES",
  "PROPOSALS",
  "PINTEREST",
  "CONTENT_CALENDAR",
  "WORKSHOP",
  "INSPO",
  "SHOT_LIST",
] as const;
const folders = ["AGREEMENTS", "INVOICES", "REPORTS", "SOCIAL_STRATEGY", "SHOOT_PLANNING"] as const;
const postStatuses = ["DRAFT", "AWAITING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "POSTED", "IDEA", "IN_PRODUCTION", "INTERNAL_REVIEW", "READY", "PUBLISHED", "ARCHIVED"] as const;

const text = (max: number) => z.string().trim().max(max);
const title = z.string().trim().min(1).max(200);

type ResourceConfig = {
  create: z.ZodObject<any>;
  update: z.ZodObject<any>;
  /** Stamp the creating user on the row. */
  stampCreator?: boolean;
};

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;
const subtasks = z.array(z.object({ id: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(200), done: z.boolean() }).strict()).max(40);

const RESOURCES: Record<ResourceName, ResourceConfig> = {
  links: {
    create: z.object({ type: z.enum(linkTypes), title, url: httpsUrl, sortOrder: z.number().int().min(0).max(9999).optional() }).strict(),
    update: z.object({ type: z.enum(linkTypes), title, url: httpsUrl, sortOrder: z.number().int().min(0).max(9999) }).partial().strict(),
  },
  files: {
    create: z.object({ folder: z.enum(folders), title, url: httpsUrl, note: text(1000).optional(), itemDate: isoDate.optional() }).strict(),
    update: z.object({ folder: z.enum(folders), title, url: httpsUrl, note: text(1000).nullable(), itemDate: isoDate.nullable() }).partial().strict(),
  },
  posts: {
    create: z
      .object({
        publishDate: isoDate,
        platform: z.string().trim().min(1).max(60),
        title: text(200).optional(),
        campaign: text(120).optional(),
        pillar: text(80).optional(),
        format: text(60).optional(),
        caption: text(5000).optional(),
        assetUrl: httpsUrl.optional(),
        status: z.enum(postStatuses).optional(),
        internalNote: text(2000).optional(),
      })
      .strict(),
    update: z
      .object({
        publishDate: isoDate,
        platform: z.string().trim().min(1).max(60),
        title: text(200).nullable(),
        campaign: text(120).nullable(),
        pillar: text(80).nullable(),
        format: text(60).nullable(),
        caption: text(5000),
        assetUrl: httpsUrl.nullable(),
        status: z.enum(postStatuses),
        internalNote: text(2000).nullable(),
      })
      .partial()
      .strict(),
  },
  ideas: {
    create: z.object({ title, note: text(2000).optional(), url: httpsUrl.optional(), pillar: text(80).optional() }).strict(),
    update: z.object({ title, note: text(2000).nullable(), url: httpsUrl.nullable(), pillar: text(80).nullable() }).partial().strict(),
    stampCreator: true,
  },
  mood: {
    create: z.object({ imageUrl: httpsUrl, caption: text(300).optional(), tags: z.array(z.string().trim().min(1).max(40)).max(12).optional() }).strict(),
    update: z.object({ imageUrl: httpsUrl, caption: text(300).nullable(), tags: z.array(z.string().trim().min(1).max(40)).max(12) }).partial().strict(),
    stampCreator: true,
  },
  tasks: {
    create: z
      .object({
        title,
        dueDate: isoDate.optional(),
        owner: z.enum(["AGENCY", "CLIENT"]).optional(),
        priority: z.enum(TASK_PRIORITIES).optional(),
        status: z.enum(TASK_STATUSES).optional(),
        notes: text(5000).optional(),
        subtasks: subtasks.optional(),
      })
      .strict(),
    update: z
      .object({
        title,
        dueDate: isoDate.nullable(),
        owner: z.enum(["AGENCY", "CLIENT"]),
        done: z.boolean(),
        priority: z.enum(TASK_PRIORITIES),
        status: z.enum(TASK_STATUSES),
        notes: text(5000).nullable(),
        subtasks,
      })
      .partial()
      .strict(),
  },
  notices: {
    create: z.object({ title, body: text(5000).optional(), pinned: z.boolean().optional() }).strict(),
    update: z.object({ title, body: text(5000), pinned: z.boolean() }).partial().strict(),
    stampCreator: true,
  },
};

const isResource = (v: string): v is ResourceName => Object.prototype.hasOwnProperty.call(RESOURCES, v);

function bad(e: z.ZodError): never {
  throw Object.assign(new HttpError(400, "Invalid input"), { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
}

export function portalRoutes(opts: { db: Db }) {
  const { db } = opts;
  const r = Router({ mergeParams: true });
  r.use(requireAdmin, resolveClient(db));

  /* ---------- Home summary ---------- */
  r.get(
    "/home",
    wrap(async (req, res) => {
      const scope = req.scope!;
      const [links, files, tasks, notices, posts] = await Promise.all([
        scope.list("links"),
        scope.list("files"),
        scope.list("tasks"),
        scope.list("notices"),
        scope.list("posts"),
      ]);
      const visiblePosts = posts;
      const today = todayZA();

      const folderCounts: Record<string, number> = {};
      for (const f of folders) folderCounts[f] = 0;
      for (const f of files) folderCounts[f.folder] = (folderCounts[f.folder] ?? 0) + 1;

      res.json({
        client: req.client,
        linkStack: links.slice(0, 9),
        folders: folderCounts,
        openTasks: tasks.filter((t) => !t.done).slice(0, 8),
        notices: notices.slice(0, 5),
        awaitingApproval: visiblePosts.filter((p) => p.status === "AWAITING_APPROVAL" || p.status === "INTERNAL_REVIEW").length,
        nextPost: visiblePosts.find((p) => p.publishDate >= today && ["APPROVED", "SCHEDULED"].includes(p.status)) ?? null,
      });
    }),
  );

  r.get(
    "/posts/:id/events",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const scope = req.scope!;
      const post = await scope.get("posts", id);
      if (!post) throw new HttpError(404, "Not found");
      const events = await db
        .select()
        .from(postEvents)
        .where(and(eq(postEvents.clientId, scope.clientId), eq(postEvents.postId, id)));
      res.json(events);
    }),
  );

  /* ---------- Generic CRUD for each section ---------- */
  r.get(
    "/:resource",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const rows = await req.scope!.list(name);
      res.json(rows);
    }),
  );

  r.post(
    "/:resource",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const cfg = RESOURCES[name];
      const parsed = cfg.create.safeParse(req.body);
      if (!parsed.success) return bad(parsed.error);
      const values: Row = { ...parsed.data };

      if (cfg.stampCreator) values.createdByUserId = req.user!.id;
      if (name === "posts" && !values.status) values.status = "DRAFT";
      // Every to-do gets a date so it always lands on the calendar and in "Up next".
      if (name === "tasks" && !values.dueDate) values.dueDate = todayZA();
      if (name === "tasks" && values.status === "DONE") {
        values.done = true;
        values.doneAt = new Date();
      }

      const row = await req.scope!.create(name, values);
      if (name === "posts") {
        await db.insert(postEvents).values({
          clientId: req.scope!.clientId,
          postId: row.id,
          actorUserId: req.user!.id,
          fromStatus: null,
          toStatus: row.status,
        });
      }
      await audit(db, { actorUserId: req.user!.id, clientId: req.scope!.clientId, action: `${name}.create`, entity: name, entityId: row.id });
      res.status(201).json(row);
    }),
  );

  r.patch(
    "/:resource/:id",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const cfg = RESOURCES[name];
      const scope = req.scope!;

      const parsed = cfg.update.safeParse(req.body);
      if (!parsed.success) return bad(parsed.error);
      const values: Row = { ...parsed.data };

      const existing = await scope.get(name, id);
      if (!existing) throw new HttpError(404, "Not found");

      if (name === "tasks") {
        // done and status describe the same thing; keep them in step whichever one the caller sets.
        if ("status" in values) values.done = values.status === "DONE";
        else if ("done" in values) values.status = values.done ? "DONE" : existing.status === "DONE" ? "TODO" : existing.status;
        if ("done" in values) values.doneAt = values.done ? new Date() : null;
      }
      if (name === "posts") values.updatedAt = new Date();

      const row = await scope.update(name, id, values);
      if (!row) throw new HttpError(404, "Not found");

      if (name === "posts" && values.status && values.status !== existing.status) {
        await db.insert(postEvents).values({
          clientId: scope.clientId,
          postId: id,
          actorUserId: req.user!.id,
          fromStatus: existing.status,
          toStatus: values.status,
        });
      }
      await audit(db, { actorUserId: req.user!.id, clientId: scope.clientId, action: `${name}.update`, entity: name, entityId: id });
      res.json(row);
    }),
  );

  r.delete(
    "/:resource/:id",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const ok = await req.scope!.remove(name, id);
      if (!ok) throw new HttpError(404, "Not found");
      await audit(db, { actorUserId: req.user!.id, clientId: req.scope!.clientId, action: `${name}.delete`, entity: name, entityId: id });
      res.json({ ok: true });
    }),
  );

  return r;
}

