import { Router } from "express";
import { and, asc, desc, eq, gte, ilike, lte, or, sql, SQL } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import type { Db } from "../db";
import { clients, posts, records, tasks } from "../db/schema";
import { HttpError, httpsUrl, isUuid, isoDate, wrap } from "../http";
import { requireAdmin } from "../middleware/auth";
import { FieldDef, MODULE_BY_KEY, MODULES, ModuleDef, SCORE_KEYS } from "../modules/registry";
import { slugify } from "./admin";

function invalid(err: z.ZodError) {
  const i = err.issues[0];
  const e = new HttpError(400, `Invalid input: ${i?.path.join(".") ?? ""} ${i?.message ?? ""}`.trim());
  return e;
}

const today = () => new Date().toISOString().slice(0, 10);

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  switch (f.type) {
    case "text":
      return z.string().trim().max(300);
    case "longtext":
      return z.string().trim().max(10000);
    case "url":
      return httpsUrl;
    case "date":
      return isoDate;
    case "select":
      return z.enum(f.options as [string, ...string[]]);
    case "number":
      return z.number().min(0).max(1e12);
    case "rating":
      return z.number().min(0).max(10);
    case "checkbox":
      return z.boolean();
    case "tags":
      return z.array(z.string().trim().min(1).max(40)).max(30);
  }
}

const schemaCache = new Map<string, { create: z.ZodObject<any>; update: z.ZodObject<any> }>();

function schemasFor(m: ModuleDef) {
  const hit = schemaCache.get(m.key);
  if (hit) return hit;
  const dataCreate: Record<string, z.ZodTypeAny> = {};
  const dataUpdate: Record<string, z.ZodTypeAny> = {};
  for (const f of m.fields) {
    const base = fieldSchema(f);
    dataCreate[f.key] = f.required ? base : base.nullish();
    dataUpdate[f.key] = base.nullish();
  }
  const statusKeys = (m.statuses ?? []).map((s) => s.key);
  const common = {
    title: z.string().trim().min(1, "A name is required").max(200),
    clientId: z.string().uuid().nullish(),
    status: statusKeys.length ? z.enum(statusKeys as [string, ...string[]]).optional() : z.never().optional(),
    date: isoDate.nullish(),
    amount: z.number().min(0).max(1e10).nullish(),
  };
  const create = z.object({ ...common, data: z.object(dataCreate).strict().default({}) }).strict();
  const update = z
    .object({ ...common, data: z.object(dataUpdate).strict() })
    .partial()
    .strict();
  const out = { create, update };
  schemaCache.set(m.key, out);
  return out;
}

type Row = typeof records.$inferSelect & { clientName: string | null; clientSlug: string | null };

function present(m: ModuleDef, r: Row) {
  const data = { ...(r.data as Record<string, unknown>) };
  if (m.key === "audits") {
    const scores = SCORE_KEYS.map((k) => data[k]).filter((v): v is number => typeof v === "number");
    data.overall = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  }
  const overdue = !!(r.date && m.open && r.status && m.open.includes(r.status) && r.date < today());
  return {
    id: r.id,
    module: r.module,
    clientId: r.clientId,
    clientName: r.clientName,
    clientSlug: r.clientSlug,
    title: r.title,
    status: r.status,
    date: r.date,
    amount: r.amountCents == null ? null : r.amountCents / 100,
    data,
    overdue,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const rowSelect = {
  id: records.id,
  module: records.module,
  clientId: records.clientId,
  title: records.title,
  status: records.status,
  date: records.date,
  amountCents: records.amountCents,
  data: records.data,
  createdByUserId: records.createdByUserId,
  isDemo: records.isDemo,
  createdAt: records.createdAt,
  updatedAt: records.updatedAt,
  clientName: clients.name,
  clientSlug: clients.slug,
};

export function recordRoutes(opts: { db: Db }) {
  const { db } = opts;
  const r = Router();
  r.use(requireAdmin);

  const mod = (key: string): ModuleDef => {
    const m = MODULE_BY_KEY.get(key);
    if (!m) throw new HttpError(404, "Not found");
    return m;
  };

  const load = async (m: ModuleDef, id: string): Promise<Row> => {
    if (!isUuid(id)) throw new HttpError(404, "Not found");
    const [row] = await db
      .select(rowSelect)
      .from(records)
      .leftJoin(clients, eq(clients.id, records.clientId))
      .where(and(eq(records.id, id), eq(records.module, m.key)))
      .limit(1);
    if (!row) throw new HttpError(404, "Not found");
    return row;
  };

  const assertClient = async (clientId: string) => {
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!c) throw new HttpError(400, "That client does not exist");
  };

  /** Module definitions, so the interface can build every list and form. */
  r.get("/modules", (_req, res) => {
    res.json(MODULES);
  });

  /** Everything with a date, for the agency calendar. */
  r.get(
    "/agenda",
    wrap(async (req, res) => {
      const from = isoDate.safeParse(req.query.from);
      const to = isoDate.safeParse(req.query.to);
      if (!from.success || !to.success) throw new HttpError(400, "from and to are required");
      const out: any[] = [];

      const recs = await db
        .select(rowSelect)
        .from(records)
        .leftJoin(clients, eq(clients.id, records.clientId))
        .where(and(gte(records.date, from.data), lte(records.date, to.data)))
        .orderBy(asc(records.date));
      for (const x of recs) {
        const m = MODULE_BY_KEY.get(x.module);
        if (!m?.calendar) continue;
        if (m.open && x.status && !m.open.includes(x.status) && x.status !== "HELD") continue;
        out.push({ kind: m.key, label: m.dateLabel ?? m.singular, id: x.id, title: x.title, date: x.date, clientName: x.clientName, clientSlug: x.clientSlug, to: `${m.route}?open=${x.id}`, overdue: present(m, x).overdue });
      }

      const ts = await db
        .select({ id: tasks.id, title: tasks.title, date: tasks.dueDate, clientName: clients.name, clientSlug: clients.slug })
        .from(tasks)
        .innerJoin(clients, eq(clients.id, tasks.clientId))
        .where(and(eq(tasks.done, false), gte(tasks.dueDate, from.data), lte(tasks.dueDate, to.data)));
      for (const t of ts) out.push({ kind: "task", label: "To-do due", id: t.id, title: t.title, date: t.date, clientName: t.clientName, clientSlug: t.clientSlug, to: "/admin/tasks", overdue: !!t.date && t.date < today() });

      const ps = await db
        .select({ id: posts.id, title: posts.title, caption: posts.caption, platform: posts.platform, date: posts.publishDate, clientName: clients.name, clientSlug: clients.slug })
        .from(posts)
        .innerJoin(clients, eq(clients.id, posts.clientId))
        .where(and(gte(posts.publishDate, from.data), lte(posts.publishDate, to.data)));
      for (const p of ps) out.push({ kind: "post", label: "Post", id: p.id, title: p.title || `${p.platform}: ${p.caption.slice(0, 50)}`, date: p.date, clientName: p.clientName, clientSlug: p.clientSlug, to: `/admin/calendar?post=${p.id}`, overdue: false });

      out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      res.json(out);
    }),
  );

  /** Everything that needs attention across modules, for the dashboard. */
  r.get(
    "/attention",
    wrap(async (_req, res) => {
      const rows = await db.select(rowSelect).from(records).leftJoin(clients, eq(clients.id, records.clientId));
      const items: { module: string; label: string; title: string; clientName: string | null; to: string; date: string | null }[] = [];
      const counts: Record<string, number> = {};
      for (const x of rows) {
        const m = MODULE_BY_KEY.get(x.module);
        if (!m) continue;
        const p = present(m, x);
        if (p.overdue) {
          items.push({ module: m.key, label: `${m.singular} overdue`, title: x.title, clientName: x.clientName, to: `${m.route}?open=${x.id}`, date: x.date });
        }
        if (x.status && m.open?.includes(x.status)) counts[m.key] = (counts[m.key] ?? 0) + 1;
      }
      items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      res.json({ overdue: items.slice(0, 12), open: counts });
    }),
  );

  r.get(
    "/:module/summary",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const rows = await db.select().from(records).where(eq(records.module, m.key));
      const t = today();
      const tiles = (m.summary ?? []).map((tile) => {
        const hit = rows.filter((x) => {
          if (tile.overdue) return !!x.date && x.date < t && !!x.status && !!m.open?.includes(x.status);
          return !!x.status && !!tile.statuses?.includes(x.status);
        });
        const value = tile.kind === "count" ? hit.length : hit.reduce((a, x) => a + (x.amountCents ?? 0), 0) / 100;
        return { label: tile.label, kind: tile.kind, value };
      });
      res.json({ tiles });
    }),
  );

  r.get(
    "/:module",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const conds: SQL[] = [eq(records.module, m.key)];
      const client = typeof req.query.client === "string" ? req.query.client : "";
      if (client) {
        if (isUuid(client)) conds.push(eq(records.clientId, client as string));
        else conds.push(eq(clients.slug, String(client).toLowerCase()));
      }
      const status = typeof req.query.status === "string" ? req.query.status : "";
      if (status) conds.push(eq(records.status, status));
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
      if (q) {
        const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
        conds.push(or(ilike(records.title, like), sql`${records.data}::text ilike ${like}`)!);
      }
      const rows = await db
        .select(rowSelect)
        .from(records)
        .leftJoin(clients, eq(clients.id, records.clientId))
        .where(and(...conds))
        .orderBy(m.dateLabel ? sql`${records.date} asc nulls last` : desc(records.createdAt), desc(records.createdAt))
        .limit(500);
      res.json(rows.map((x) => present(m, x)));
    }),
  );

  r.post(
    "/:module",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const parsed = schemasFor(m).create.safeParse(req.body);
      if (!parsed.success) throw invalid(parsed.error);
      const b = parsed.data as any;
      if (m.client === "required" && !b.clientId) throw new HttpError(400, "Choose a client");
      if (b.clientId) await assertClient(b.clientId);
      if (m.amountRequired && b.amount == null) throw new HttpError(400, "An amount is required");
      const status = b.status ?? m.statuses?.[0]?.key ?? null;
      const data = Object.fromEntries(Object.entries(b.data ?? {}).filter(([, v]) => v !== null && v !== ""));
      const [row] = await db
        .insert(records)
        .values({
          module: m.key,
          clientId: b.clientId ?? null,
          title: b.title,
          status,
          date: b.date ?? null,
          amountCents: b.amount == null ? null : Math.round(b.amount * 100),
          data,
          createdByUserId: req.user!.id,
        })
        .returning();
      await audit(db, { actorUserId: req.user!.id, clientId: row.clientId, action: `${m.key}.create`, entity: m.key, entityId: row.id });
      res.status(201).json(present(m, await load(m, row.id)));
    }),
  );

  r.patch(
    "/:module/:id",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const existing = await load(m, String(req.params.id));
      const parsed = schemasFor(m).update.safeParse(req.body);
      if (!parsed.success) throw invalid(parsed.error);
      if (Object.keys(parsed.data).length === 0) throw new HttpError(400, "Nothing to change");
      const b = parsed.data as any;
      const set: Partial<typeof records.$inferInsert> = { updatedAt: new Date() };
      if (b.title !== undefined) set.title = b.title;
      if (b.status !== undefined) set.status = b.status;
      if (b.date !== undefined) set.date = b.date;
      if (b.amount !== undefined) set.amountCents = b.amount == null ? null : Math.round(b.amount * 100);
      if (b.clientId !== undefined) {
        if (b.clientId) await assertClient(b.clientId);
        else if (m.client === "required") throw new HttpError(400, "Choose a client");
        set.clientId = b.clientId ?? null;
      }
      if (b.data !== undefined) {
        const merged = { ...(existing.data as Record<string, unknown>) };
        for (const [k, v] of Object.entries(b.data)) {
          if (v === null || v === "") delete merged[k];
          else merged[k] = v;
        }
        set.data = merged;
      }
      await db.update(records).set(set).where(eq(records.id, existing.id));
      await audit(db, { actorUserId: req.user!.id, clientId: existing.clientId, action: `${m.key}.update`, entity: m.key, entityId: existing.id });
      res.json(present(m, await load(m, existing.id)));
    }),
  );

  r.delete(
    "/:module/:id",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const existing = await load(m, String(req.params.id));
      await db.delete(records).where(eq(records.id, existing.id));
      await audit(db, { actorUserId: req.user!.id, clientId: existing.clientId, action: `${m.key}.delete`, entity: m.key, entityId: existing.id });
      res.json({ ok: true });
    }),
  );

  const lines = (v: unknown) =>
    String(v ?? "")
      .split(/\r?\n/)
      .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
      .filter(Boolean)
      .slice(0, 50);

  r.post(
    "/:module/:id/actions/:action",
    wrap(async (req, res) => {
      const m = mod(String(req.params.module));
      const action = String(req.params.action);
      if (!m.actions?.some((a) => a.key === action)) throw new HttpError(404, "Not found");
      const rec = await load(m, String(req.params.id));
      const data = rec.data as Record<string, any>;
      const bodyClient = z.object({ clientId: z.string().uuid().optional() }).strict().safeParse(req.body ?? {});
      if (!bodyClient.success) throw new HttpError(400, "Invalid input");
      const clientId = rec.clientId ?? bodyClient.data.clientId ?? null;
      if (clientId) await assertClient(clientId);
      const needClient = () => {
        if (!clientId) throw new HttpError(400, "Choose a client first");
        return clientId;
      };
      const actor = req.user!.id;

      if (action === "toTask") {
        const [t] = await db.insert(tasks).values({ clientId: needClient(), title: rec.title, notes: data.details ?? null, owner: "AGENCY", priority: String(data.priority ?? "Normal").toUpperCase() }).returning();
        await db.update(records).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(records.id, rec.id));
        await audit(db, { actorUserId: actor, clientId, action: "ideas.to_task", entity: "task", entityId: t.id });
        return res.json({ ok: true, message: "Added to that client's to-dos." });
      }
      if (action === "toProject") {
        const [p] = await db.insert(records).values({ module: "projects", clientId: needClient(), title: rec.title, status: "PLANNING", data: { description: data.details ?? undefined, priority: data.priority ?? undefined }, createdByUserId: actor }).returning();
        await db.update(records).set({ status: "APPROVED", updatedAt: new Date() }).where(eq(records.id, rec.id));
        await audit(db, { actorUserId: actor, clientId, action: "ideas.to_project", entity: "projects", entityId: p.id });
        return res.json({ ok: true, message: "Created a project in Planning." });
      }
      if (action === "actionsToTasks" || action === "recommendationsToTasks") {
        const key = action === "actionsToTasks" ? "actionItems" : "recommendations";
        const flag = action === "actionsToTasks" ? "actionsCreated" : "tasksCreated";
        if (data[flag]) throw new HttpError(409, "Those have already been turned into to-dos");
        const items = lines(data[key]);
        if (!items.length) throw new HttpError(400, action === "actionsToTasks" ? "Add action items first, one per line" : "Add recommendations first, one per line");
        const cid = needClient();
        await db.insert(tasks).values(items.map((title) => ({ clientId: cid, title: title.slice(0, 200), owner: "AGENCY" as const, notes: `From ${m.singular}: ${rec.title}` })));
        await db.update(records).set({ data: { ...data, [flag]: true }, updatedAt: new Date() }).where(eq(records.id, rec.id));
        await audit(db, { actorUserId: actor, clientId: cid, action: `${m.key}.to_tasks`, entity: m.key, entityId: rec.id });
        return res.json({ ok: true, message: `Created ${items.length} to-do${items.length === 1 ? "" : "s"}.` });
      }
      if (action === "convertLead") {
        if (data.clientId) throw new HttpError(409, "This lead has already been converted");
        const base = slugify(rec.title);
        let slug = base;
        for (let i = 2; ; i++) {
          const [hit] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug)).limit(1);
          if (!hit) break;
          slug = `${base}-${i}`;
        }
        const [c] = await db.insert(clients).values({ name: rec.title, slug }).returning();
        await db.update(records).set({ status: "WON", clientId: c.id, data: { ...data, clientId: c.id }, updatedAt: new Date() }).where(eq(records.id, rec.id));
        await audit(db, { actorUserId: actor, clientId: c.id, action: "leads.convert", entity: "client", entityId: c.id });
        return res.json({ ok: true, message: `${c.name} is now a client.`, clientSlug: c.slug });
      }
      throw new HttpError(404, "Not found");
    }),
  );

  return r;
}
