import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import type { Db } from "../db";
import { postEvents } from "../db/schema";
import { HttpError, httpsUrl, isUuid, isoDate, wrap } from "../http";
import { resolveClient } from "../middleware/clientScope";
import { requireAuth } from "../middleware/auth";
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
const postStatuses = ["DRAFT", "AWAITING_APPROVAL", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "POSTED"] as const;

const text = (max: number) => z.string().trim().max(max);
const title = z.string().trim().min(1).max(200);

type ResourceConfig = {
  create: z.ZodObject<any>;
  update: z.ZodObject<any>;
  /** What a CLIENT user may do. Admins may always do everything. */
  client: {
    create?: boolean;
    update?: z.ZodObject<any>; // restricted fields a client may change
    updateOwnOnly?: boolean; // limited to rows the client user created
    remove?: boolean;
  };
  /** Stamp the creating user on the row. */
  stampCreator?: boolean;
};

const RESOURCES: Record<ResourceName, ResourceConfig> = {
  links: {
    create: z.object({ type: z.enum(linkTypes), title, url: httpsUrl, sortOrder: z.number().int().min(0).max(9999).optional() }).strict(),
    update: z.object({ type: z.enum(linkTypes), title, url: httpsUrl, sortOrder: z.number().int().min(0).max(9999) }).partial().strict(),
    client: {},
  },
  files: {
    create: z.object({ folder: z.enum(folders), title, url: httpsUrl, note: text(1000).optional(), itemDate: isoDate.optional() }).strict(),
    update: z.object({ folder: z.enum(folders), title, url: httpsUrl, note: text(1000).nullable(), itemDate: isoDate.nullable() }).partial().strict(),
    client: {},
  },
  posts: {
    create: z
      .object({
        publishDate: isoDate,
        platform: z.string().trim().min(1).max(60),
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
        pillar: text(80).nullable(),
        format: text(60).nullable(),
        caption: text(5000),
        assetUrl: httpsUrl.nullable(),
        status: z.enum(postStatuses),
        internalNote: text(2000).nullable(),
      })
      .partial()
      .strict(),
    client: {}, // clients respond through /posts/:id/respond, never by editing
  },
  ideas: {
    create: z.object({ title, note: text(2000).optional(), url: httpsUrl.optional(), pillar: text(80).optional() }).strict(),
    update: z.object({ title, note: text(2000).nullable(), url: httpsUrl.nullable(), pillar: text(80).nullable() }).partial().strict(),
    client: {
      create: true,
      update: z.object({ title, note: text(2000).nullable(), url: httpsUrl.nullable(), pillar: text(80).nullable() }).partial().strict(),
      updateOwnOnly: true,
    },
    stampCreator: true,
  },
  mood: {
    create: z.object({ imageUrl: httpsUrl, caption: text(300).optional(), tags: z.array(z.string().trim().min(1).max(40)).max(12).optional() }).strict(),
    update: z.object({ imageUrl: httpsUrl, caption: text(300).nullable(), tags: z.array(z.string().trim().min(1).max(40)).max(12) }).partial().strict(),
    client: { create: true },
    stampCreator: true,
  },
  tasks: {
    create: z.object({ title, dueDate: isoDate.optional(), owner: z.enum(["AGENCY", "CLIENT"]).optional() }).strict(),
    update: z.object({ title, dueDate: isoDate.nullable(), owner: z.enum(["AGENCY", "CLIENT"]), done: z.boolean() }).partial().strict(),
    client: {
      create: true,
      update: z.object({ done: z.boolean() }).strict(), // a client may only tick or untick
    },
  },
  notices: {
    create: z.object({ title, body: text(5000).optional(), pinned: z.boolean().optional() }).strict(),
    update: z.object({ title, body: text(5000), pinned: z.boolean() }).partial().strict(),
    client: {},
    stampCreator: true,
  },
};

const isResource = (v: string): v is ResourceName => Object.prototype.hasOwnProperty.call(RESOURCES, v);

/** What a client is allowed to see. Drafts and internal notes are the agency's working space. */
function viewFor(isClient: boolean, name: ResourceName, rows: Row[]): Row[] {
  if (!isClient) return rows;
  if (name === "posts") {
    return rows.filter((r) => r.status !== "DRAFT").map(({ internalNote: _n, ...rest }) => rest);
  }
  return rows;
}

function bad(e: z.ZodError): never {
  throw Object.assign(new HttpError(400, "Invalid input"), { issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
}

export function portalRoutes(opts: { db: Db }) {
  const { db } = opts;
  const r = Router({ mergeParams: true });
  r.use(requireAuth, resolveClient(db));

  /* ---------- Home summary ---------- */
  r.get(
    "/home",
    wrap(async (req, res) => {
      const scope = req.scope!;
      const isClient = req.user!.role === "CLIENT";
      const [links, files, tasks, notices, posts] = await Promise.all([
        scope.list("links"),
        scope.list("files"),
        scope.list("tasks"),
        scope.list("notices"),
        scope.list("posts"),
      ]);
      const visiblePosts = viewFor(isClient, "posts", posts);
      const today = new Date().toISOString().slice(0, 10);

      const folderCounts: Record<string, number> = {};
      for (const f of folders) folderCounts[f] = 0;
      for (const f of files) folderCounts[f.folder] = (folderCounts[f.folder] ?? 0) + 1;

      res.json({
        client: req.client,
        linkStack: links.slice(0, 9),
        folders: folderCounts,
        openTasks: tasks.filter((t) => !t.done).slice(0, 8),
        notices: notices.slice(0, 5),
        awaitingApproval: visiblePosts.filter((p) => p.status === "AWAITING_APPROVAL").length,
        nextPost: visiblePosts.find((p) => p.publishDate >= today && ["APPROVED", "SCHEDULED"].includes(p.status)) ?? null,
      });
    }),
  );

  /* ---------- Client responds to a post ---------- */
  r.post(
    "/posts/:id/respond",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const parsed = z
        .object({ decision: z.enum(["APPROVE", "REQUEST_CHANGES"]), comment: text(2000).optional() })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) return bad(parsed.error);
      const { decision, comment } = parsed.data;
      if (decision === "REQUEST_CHANGES" && !comment) throw new HttpError(400, "Please say what should change");

      const scope = req.scope!;
      const post = await scope.get("posts", id);
      if (!post || (req.user!.role === "CLIENT" && post.status === "DRAFT")) throw new HttpError(404, "Not found");
      if (post.status !== "AWAITING_APPROVAL") throw new HttpError(409, "This post is not awaiting approval");

      const toStatus = decision === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED";
      // The status guard lives in the WHERE clause, so two people answering at once cannot both win.
      const row = await scope.moveStatus(id, "AWAITING_APPROVAL", toStatus);
      if (!row) throw new HttpError(409, "This post is no longer awaiting approval");
      await db.insert(postEvents).values({
        clientId: scope.clientId,
        postId: id,
        actorUserId: req.user!.id,
        fromStatus: "AWAITING_APPROVAL",
        toStatus,
        comment: comment ?? null,
      });
      await audit(db, { actorUserId: req.user!.id, clientId: scope.clientId, action: `post.${decision.toLowerCase()}`, entity: "post", entityId: id });
      res.json(viewFor(req.user!.role === "CLIENT", "posts", [row])[0]);
    }),
  );

  r.get(
    "/posts/:id/events",
    wrap(async (req, res) => {
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      const scope = req.scope!;
      const post = await scope.get("posts", id);
      if (!post || (req.user!.role === "CLIENT" && post.status === "DRAFT")) throw new HttpError(404, "Not found");
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
      res.json(viewFor(req.user!.role === "CLIENT", name, rows));
    }),
  );

  r.post(
    "/:resource",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const cfg = RESOURCES[name];
      const isClient = req.user!.role === "CLIENT";
      if (isClient && !cfg.client.create) throw new HttpError(403, "You can't add to this section");

      const parsed = cfg.create.safeParse(req.body);
      if (!parsed.success) return bad(parsed.error);
      const values: Row = { ...parsed.data };

      if (cfg.stampCreator) values.createdByUserId = req.user!.id;
      if (name === "tasks" && isClient) values.owner = "CLIENT";
      if (name === "posts" && !values.status) values.status = "DRAFT";

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
      res.status(201).json(viewFor(isClient, name, [row])[0]);
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
      const isClient = req.user!.role === "CLIENT";
      const scope = req.scope!;

      let schema: z.ZodObject<any> = cfg.update;
      if (isClient) {
        if (!cfg.client.update) throw new HttpError(403, "You can't change this section");
        schema = cfg.client.update;
      }
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return bad(parsed.error);
      const values: Row = { ...parsed.data };

      const existing = await scope.get(name, id);
      if (!existing || (isClient && name === "posts" && existing.status === "DRAFT")) throw new HttpError(404, "Not found");
      if (isClient && cfg.client.updateOwnOnly && existing.createdByUserId !== req.user!.id) {
        throw new HttpError(403, "You can only change your own entries");
      }

      if (name === "tasks" && "done" in values) values.doneAt = values.done ? new Date() : null;
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
      res.json(viewFor(isClient, name, [row])[0]);
    }),
  );

  r.delete(
    "/:resource/:id",
    wrap(async (req, res, next) => {
      const name = String(req.params.resource);
      if (!isResource(name)) return next();
      const id = String(req.params.id);
      if (!isUuid(id)) throw new HttpError(404, "Not found");
      if (req.user!.role === "CLIENT" && !RESOURCES[name].client.remove) throw new HttpError(403, "You can't delete from this section");
      const ok = await req.scope!.remove(name, id);
      if (!ok) throw new HttpError(404, "Not found");
      await audit(db, { actorUserId: req.user!.id, clientId: req.scope!.clientId, action: `${name}.delete`, entity: name, entityId: id });
      res.json({ ok: true });
    }),
  );

  return r;
}

