import { Router } from "express";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import type { Db } from "../db";
import { appSettings, clients, timeEntries } from "../db/schema";
import { HttpError, isUuid, isoDate, wrap } from "../http";
import { requireAdmin } from "../middleware/auth";
import { daysInMonth, todayZA } from "../util/dates";

const MAX_MINUTES = 24 * 60;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const note = z.string().trim().max(300);

const entryCreate = z.object({ clientId: z.string().uuid(), date: isoDate, minutes: z.number().int().min(1).max(MAX_MINUTES), note: note.optional() }).strict();
const entryUpdate = z.object({ date: isoDate, minutes: z.number().int().min(1).max(MAX_MINUTES), note }).partial().strict();
const startBody = z.object({ clientId: z.string().uuid(), note: note.optional() }).strict();

export type Health = "no-fee" | "no-time" | "no-target" | "ok" | "watch" | "loss";

/** How a retainer is doing against the rate you want to earn per hour. */
export function healthOf(fee: number | null, minutes: number, target: number | null): { rate: number | null; health: Health; gap: number | null } {
  if (!fee) return { rate: null, health: "no-fee", gap: null };
  if (minutes <= 0) return { rate: null, health: "no-time", gap: null };
  const hours = minutes / 60;
  const rate = fee / hours;
  if (!target) return { rate, health: "no-target", gap: null };
  const gap = fee - hours * target; // what the retainer paid, minus what the hours were worth at your target rate
  return { rate, health: rate >= target ? "ok" : rate >= target * 0.7 ? "watch" : "loss", gap };
}

export function timeRoutes(opts: { db: Db }) {
  const { db } = opts;
  const r = Router();
  r.use(requireAdmin);

  const elapsedMinutes = (startedAt: Date, now = new Date()) => Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

  const running = async (userId: string) => {
    const [row] = await db
      .select({ id: timeEntries.id, clientId: timeEntries.clientId, clientName: clients.name, note: timeEntries.note, startedAt: timeEntries.startedAt })
      .from(timeEntries)
      .innerJoin(clients, eq(clients.id, timeEntries.clientId))
      .where(and(eq(timeEntries.userId, userId), isNotNull(timeEntries.startedAt), isNull(timeEntries.minutes)))
      .limit(1);
    return row ?? null;
  };

  const stopRunning = async (userId: string) => {
    const cur = await running(userId);
    if (!cur?.startedAt) return null;
    const minutes = Math.min(elapsedMinutes(cur.startedAt), MAX_MINUTES);
    const [row] = await db.update(timeEntries).set({ minutes }).where(eq(timeEntries.id, cur.id)).returning();
    return row;
  };

  r.get("/running", wrap(async (req, res) => res.json({ running: await running(req.user!.id), now: new Date().toISOString() })));

  r.post(
    "/start",
    wrap(async (req, res) => {
      const p = startBody.safeParse(req.body);
      if (!p.success) throw new HttpError(400, "Choose a client to time");
      const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, p.data.clientId)).limit(1);
      if (!c) throw new HttpError(400, "That client does not exist");
      await stopRunning(req.user!.id); // one timer at a time
      await db.insert(timeEntries).values({ clientId: p.data.clientId, userId: req.user!.id, note: p.data.note ?? "", workDate: todayZA(), startedAt: new Date() });
      res.status(201).json({ running: await running(req.user!.id), now: new Date().toISOString() });
    }),
  );

  r.post(
    "/stop",
    wrap(async (req, res) => {
      const stopped = await stopRunning(req.user!.id);
      if (!stopped) throw new HttpError(409, "No timer is running");
      await audit(db, { actorUserId: req.user!.id, clientId: stopped.clientId, action: "time.log", entity: "time", entityId: stopped.id });
      res.json({ entry: stopped });
    }),
  );

  const range = (m: string) => ({ from: `${m}-01`, to: `${m}-${String(daysInMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)))).padStart(2, "0")}` });

  r.get(
    "/entries",
    wrap(async (req, res) => {
      const m = month.safeParse(req.query.month ?? todayZA().slice(0, 7));
      if (!m.success) throw new HttpError(400, "month must look like 2026-11");
      const { from, to } = range(m.data);
      const conds = [gte(timeEntries.workDate, from), lte(timeEntries.workDate, to), isNotNull(timeEntries.minutes)];
      if (typeof req.query.client === "string" && isUuid(req.query.client)) conds.push(eq(timeEntries.clientId, req.query.client));
      const rows = await db
        .select({ id: timeEntries.id, clientId: timeEntries.clientId, clientName: clients.name, clientSlug: clients.slug, note: timeEntries.note, date: timeEntries.workDate, minutes: timeEntries.minutes })
        .from(timeEntries)
        .innerJoin(clients, eq(clients.id, timeEntries.clientId))
        .where(and(...conds))
        .orderBy(desc(timeEntries.workDate), desc(timeEntries.createdAt))
        .limit(500);
      res.json(rows);
    }),
  );

  r.post(
    "/entries",
    wrap(async (req, res) => {
      const p = entryCreate.safeParse(req.body);
      if (!p.success) throw new HttpError(400, "Choose a client, a date and the minutes worked");
      const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, p.data.clientId)).limit(1);
      if (!c) throw new HttpError(400, "That client does not exist");
      const [row] = await db.insert(timeEntries).values({ clientId: p.data.clientId, userId: req.user!.id, workDate: p.data.date, minutes: p.data.minutes, note: p.data.note ?? "" }).returning();
      await audit(db, { actorUserId: req.user!.id, clientId: row.clientId, action: "time.log", entity: "time", entityId: row.id });
      res.status(201).json(row);
    }),
  );

  r.patch(
    "/entries/:id",
    wrap(async (req, res) => {
      if (!isUuid(String(req.params.id))) throw new HttpError(404, "Not found");
      const p = entryUpdate.safeParse(req.body);
      if (!p.success || Object.keys(p.data).length === 0) throw new HttpError(400, "Nothing valid to change");
      const set: Partial<typeof timeEntries.$inferInsert> = {};
      if (p.data.date) set.workDate = p.data.date;
      if (p.data.minutes) set.minutes = p.data.minutes;
      if (p.data.note !== undefined) set.note = p.data.note;
      const [row] = await db.update(timeEntries).set(set).where(and(eq(timeEntries.id, String(req.params.id)), isNotNull(timeEntries.minutes))).returning();
      if (!row) throw new HttpError(404, "Not found");
      res.json(row);
    }),
  );

  r.delete(
    "/entries/:id",
    wrap(async (req, res) => {
      if (!isUuid(String(req.params.id))) throw new HttpError(404, "Not found");
      const gone = await db.delete(timeEntries).where(and(eq(timeEntries.id, String(req.params.id)), isNotNull(timeEntries.minutes))).returning({ id: timeEntries.id });
      if (gone.length === 0) throw new HttpError(404, "Not found");
      res.status(204).end();
    }),
  );

  const getTarget = async () => {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "targetHourlyRate")).limit(1);
    const v = row?.value;
    return typeof v === "number" && v > 0 ? v : null;
  };

  r.put(
    "/target",
    wrap(async (req, res) => {
      const p = z.object({ rate: z.number().min(0).max(100000).nullable() }).strict().safeParse(req.body);
      if (!p.success) throw new HttpError(400, "Enter a rate in rand per hour");
      const value = p.data.rate && p.data.rate > 0 ? p.data.rate : 0;
      await db.insert(appSettings).values({ key: "targetHourlyRate", value }).onConflictDoUpdate({ target: appSettings.key, set: { value } });
      res.json({ target: value || null });
    }),
  );

  /** Per client for a month: hours logged against the retainer, and what each hour earned. */
  r.get(
    "/summary",
    wrap(async (req, res) => {
      const m = month.safeParse(req.query.month ?? todayZA().slice(0, 7));
      if (!m.success) throw new HttpError(400, "month must look like 2026-11");
      const { from, to } = range(m.data);
      const target = await getTarget();
      const logged = await db
        .select({ clientId: timeEntries.clientId, minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` })
        .from(timeEntries)
        .where(and(gte(timeEntries.workDate, from), lte(timeEntries.workDate, to), isNotNull(timeEntries.minutes)))
        .groupBy(timeEntries.clientId);
      const minutesBy = new Map(logged.map((l) => [l.clientId, l.minutes]));
      const all = await db.select({ id: clients.id, name: clients.name, slug: clients.slug, status: clients.status, profile: clients.profile }).from(clients).where(ne(clients.status, "ARCHIVED")).orderBy(asc(clients.name));
      const rows = all
        .map((c) => {
          const fee = (c.profile as { monthlyFee?: number }).monthlyFee ?? null;
          const minutes = minutesBy.get(c.id) ?? 0;
          return { clientId: c.id, name: c.name, slug: c.slug, fee, minutes, ...healthOf(fee, minutes, target) };
        })
        .filter((c) => c.fee || c.minutes);
      const totalMinutes = rows.reduce((a, c) => a + c.minutes, 0);
      const totalFees = rows.reduce((a, c) => a + (c.minutes > 0 ? (c.fee ?? 0) : 0), 0);
      res.json({ month: m.data, target, rows, totalMinutes, blendedRate: totalMinutes > 0 && totalFees > 0 ? totalFees / (totalMinutes / 60) : null });
    }),
  );

  return r;
}
