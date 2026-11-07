import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { audit } from "../audit";
import type { Db } from "../db";
import { clients, records, tasks } from "../db/schema";
import { HttpError, isUuid, wrap } from "../http";
import { requireAdmin } from "../middleware/auth";
import { addDays, nextMonthly, todayZA } from "../util/dates";
import { runRecurring } from "../jobs/recurring";

/** The standard first weeks with a new client. Edit this list to change what every onboarding creates. */
export const ONBOARDING_TASKS: { title: string; days: number; priority: "NORMAL" | "HIGH"; note?: string }[] = [
  { title: "Send welcome email and what happens next", days: 0, priority: "HIGH" },
  { title: "Send brand questionnaire", days: 1, priority: "HIGH", note: "Questions are in the Discovery questionnaire meeting note." },
  { title: "Get the signed agreement back", days: 3, priority: "HIGH" },
  { title: "Set up the retainer invoice", days: 3, priority: "NORMAL" },
  { title: "Request logo files (vector and PNG)", days: 4, priority: "NORMAL", note: "Ask for AI, SVG or EPS, plus a transparent PNG." },
  { title: "Request brand guidelines, fonts and colour codes", days: 4, priority: "NORMAL" },
  { title: "Request photos, videos and product shots", days: 5, priority: "NORMAL" },
  { title: "Get access to social accounts through each platform's partner or business access", days: 5, priority: "HIGH", note: "Never ask for passwords. Use Meta Business, LinkedIn admin roles and similar." },
  { title: "Get access to the website, domain and analytics", days: 5, priority: "NORMAL", note: "Share through a password manager or an admin invite, not by message." },
  { title: "Hold the kick-off meeting", days: 3, priority: "HIGH" },
  { title: "Research competitors and audience", days: 7, priority: "NORMAL" },
  { title: "Run the first brand, social and website audit", days: 10, priority: "NORMAL" },
  { title: "Draft the first month's content plan", days: 14, priority: "NORMAL" },
];

export const QUESTIONNAIRE = [
  "What does your business do, and what do you want to be known for?",
  "Who is your ideal customer? Describe the person, not just the demographic.",
  "Who are your three closest competitors, and what do they do well or badly?",
  "What makes you different from them? Why do customers choose you?",
  "Which three words should people use to describe your brand?",
  "Which brands (in any industry) do you admire, and why?",
  "What are your main goals for the next 6 to 12 months (sales, followers, leads, launch)?",
  "What has worked or not worked in your marketing so far?",
  "Which platforms are you on now, and which do you want to be on?",
  "Do you have brand guidelines, a logo, fonts and colours we should use?",
  "Is there anything we should never say, show or do?",
  "Who approves content on your side, and how quickly can they respond?",
  "What budget and timelines are we working within?",
];

const ONBOARDING_TAG = "onboarding";
const startBody = z.object({ recurring: z.boolean().optional() }).strict();

export function onboardingRoutes(opts: { db: Db }) {
  const { db } = opts;
  const r = Router();
  r.use(requireAdmin);

  r.get("/template", (_req, res) => res.json({ tasks: ONBOARDING_TASKS, questions: QUESTIONNAIRE }));

  const clientOr404 = async (idRaw: string) => {
    if (!isUuid(idRaw)) throw new HttpError(404, "Not found");
    const [c] = await db.select().from(clients).where(eq(clients.id, idRaw)).limit(1);
    if (!c) throw new HttpError(404, "Not found");
    return c;
  };

  r.get(
    "/:clientId",
    wrap(async (req, res) => {
      const c = await clientOr404(String(req.params.clientId));
      const started = (c.profile as { onboardedAt?: string }).onboardedAt ?? null;
      const rows = await db
        .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, done: tasks.done })
        .from(tasks)
        .where(and(eq(tasks.clientId, c.id), eq(tasks.tag, ONBOARDING_TAG)))
        .orderBy(asc(tasks.done), asc(tasks.dueDate));
      const [q] = await db.select({ id: records.id }).from(records).where(and(eq(records.module, "meetings"), eq(records.clientId, c.id), eq(records.title, `Discovery questionnaire: ${c.name}`))).limit(1);
      res.json({
        started,
        total: rows.length,
        done: rows.filter((t) => t.done).length,
        remaining: rows.filter((t) => !t.done).slice(0, 6),
        questionnaireId: q?.id ?? null,
        questions: QUESTIONNAIRE,
      });
    }),
  );

  r.post(
    "/:clientId",
    wrap(async (req, res) => {
      const c = await clientOr404(String(req.params.clientId));
      const body = startBody.safeParse(req.body ?? {});
      if (!body.success) throw new HttpError(400, "Invalid input");
      const profile = c.profile as { onboardedAt?: string; monthlyFee?: number };
      if (profile.onboardedAt) throw new HttpError(409, "Onboarding has already been started for this client");
      const today = todayZA();
      const clientName = c.name.replace(/\s*\(demo\)/i, "");

      await db.transaction(async (tx) => {
        await tx.insert(tasks).values(
          ONBOARDING_TASKS.map((t) => ({ clientId: c.id, title: t.title, dueDate: addDays(today, t.days), owner: "AGENCY" as const, priority: t.priority, tag: ONBOARDING_TAG, notes: t.note ?? null })),
        );
        await tx.insert(records).values([
          {
            module: "meetings",
            clientId: c.id,
            title: `Discovery questionnaire: ${c.name}`,
            status: "SCHEDULED",
            date: addDays(today, 2),
            createdByUserId: req.user!.id,
            data: { meetingType: "Discovery", agenda: "Send these questions to the client, then record their answers below each one.", notes: QUESTIONNAIRE.map((q, i) => `${i + 1}. ${q}\nAnswer: `).join("\n\n") },
          },
          {
            module: "meetings",
            clientId: c.id,
            title: `Kick-off meeting: ${clientName}`,
            status: "SCHEDULED",
            date: addDays(today, 3),
            createdByUserId: req.user!.id,
            data: { meetingType: "Kick-off", agenda: "Introductions and roles\nGoals and success measures\nWhat we need from you and by when\nContent approvals and communication\nTimeline for the first 30 days" },
          },
        ]);
        await tx.update(clients).set({ status: "ONBOARDING", profile: { ...profile, onboardedAt: today } }).where(eq(clients.id, c.id));

        if (body.data.recurring) {
          const firstOfMonth = today.endsWith("-01") ? today : nextMonthly(today, 1);
          const report = today.slice(8, 10) <= "28" ? `${today.slice(0, 8)}28` : nextMonthly(today, 28);
          const rules: { title: string; date: string; data: Record<string, string>; amountCents: number | null }[] = [
            { title: `Monthly report: ${clientName} ({month})`, date: report < today ? nextMonthly(today, 28) : report, data: { kind: "To-do", frequency: "Monthly", monthDay: "28", priority: "Normal" }, amountCents: null },
            { title: `Plan next week's content: ${clientName}`, date: nextMonday(today), data: { kind: "To-do", frequency: "Weekly", priority: "Normal" }, amountCents: null },
          ];
          if (profile.monthlyFee) rules.unshift({ title: `${clientName} retainer, {month}`, date: firstOfMonth, data: { kind: "Invoice", frequency: "Monthly", monthDay: "1", terms: "7 days" }, amountCents: Math.round(profile.monthlyFee * 100) });
          await tx.insert(records).values(rules.map((x) => ({ module: "recurring", clientId: c.id, status: "ACTIVE", createdByUserId: req.user!.id, ...x })));
        }
      });
      await audit(db, { actorUserId: req.user!.id, clientId: c.id, action: "onboarding.start", entity: "client", entityId: c.id });
      await runRecurring(db);
      res.status(201).json({ ok: true });
    }),
  );

  return r;
}

function nextMonday(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const add = ((8 - dow) % 7) || 7;
  return addDays(iso, add);
}
