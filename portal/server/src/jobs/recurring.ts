import { and, eq, lte } from "drizzle-orm";
import { audit } from "../audit";
import type { Db } from "../db";
import { clients, posts, records, tasks } from "../db/schema";
import { addDays, monthName, nextMonthly, todayZA } from "../util/dates";

type Rule = typeof records.$inferSelect;
export type RunResult = { rules: number; created: number };

const MAX_CATCH_UP = 3;

function monthDayOf(rule: Rule): number {
  const raw = (rule.data as Record<string, unknown>).monthDay;
  if (raw === "Last day") return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 31) return n;
  return Math.min(Number((rule.date ?? "2000-01-01").slice(8, 10)), 28);
}

function nextRun(rule: Rule, from: string): string {
  const freq = (rule.data as Record<string, unknown>).frequency;
  return freq === "Weekly" ? addDays(from, 7) : nextMonthly(from, monthDayOf(rule));
}

/** "Monthly report: {month}" becomes "Monthly report: November 2026". */
const nameFor = (template: string, occurrence: string) => template.replace(/\{month\}/gi, monthName(occurrence)).replace(/\{date\}/gi, occurrence);

/**
 * Creates the to-dos, invoices and post ideas that are due. Safe to call as often as you like:
 * each rule is moved on with a compare-and-set on its next-run date, so an occurrence is only ever created once.
 */
export async function runRecurring(db: Db, now: Date = new Date()): Promise<RunResult> {
  const today = todayZA(now);
  const due = await db
    .select()
    .from(records)
    .where(and(eq(records.module, "recurring"), eq(records.status, "ACTIVE"), lte(records.date, today)));
  let created = 0;

  for (const rule of due) {
    if (!rule.clientId || !rule.date) continue;
    const clientId = rule.clientId;
    // Work out every occurrence up to today, then keep only the latest few so an old rule can't flood the lists.
    const occurrences: string[] = [];
    let cursor = rule.date;
    let guard = 0;
    while (cursor <= today && guard++ < 400) {
      occurrences.push(cursor);
      cursor = nextRun(rule, cursor);
    }
    const make = occurrences.slice(-MAX_CATCH_UP);
    const data = rule.data as Record<string, unknown>;
    const kind = String(data.kind ?? "To-do");

    const made = await db.transaction(async (tx) => {
      const moved = await tx
        .update(records)
        .set({ date: cursor, data: { ...data, lastRun: make[make.length - 1] }, updatedAt: new Date() })
        .where(and(eq(records.id, rule.id), eq(records.date, rule.date!)))
        .returning({ id: records.id });
      if (moved.length === 0) return 0; // another run got there first

      const [client] = await tx.select({ profile: clients.profile }).from(clients).where(eq(clients.id, clientId)).limit(1);
      for (const occ of make) {
        const title = nameFor(rule.title, occ);
        if (kind === "Invoice") {
          const fee = (client?.profile as { monthlyFee?: number } | undefined)?.monthlyFee;
          const cents = rule.amountCents ?? (fee != null ? Math.round(fee * 100) : 0);
          const days = parseInt(String(data.terms ?? "7"), 10) || 7;
          await tx.insert(records).values({
            module: "finance",
            clientId,
            title,
            status: "DRAFT",
            date: addDays(occ, days),
            amountCents: cents,
            data: { docType: "Retainer", issueDate: occ, note: "Created automatically by a recurring rule. Check it, then mark it as sent." },
          });
        } else if (kind === "Post idea") {
          await tx.insert(posts).values({ clientId, publishDate: occ, platform: String(data.platform ?? "Instagram"), title, caption: "", status: "DRAFT", internalNote: "Created by a recurring rule." });
        } else {
          await tx.insert(tasks).values({
            clientId,
            title: title.slice(0, 200),
            dueDate: occ,
            owner: "AGENCY",
            priority: String(data.priority ?? "Normal").toUpperCase(),
            tag: "recurring",
            notes: typeof data.note === "string" ? data.note : null,
          });
        }
      }
      return make.length;
    });

    if (made > 0) {
      created += made;
      await audit(db, { actorUserId: null, clientId, action: "recurring.run", entity: "recurring", entityId: rule.id });
    }
  }
  return { rules: due.length, created };
}

/** Checks for due rules now and then every half hour. Errors are logged, never thrown, so a bad rule can't stop the server. */
export function startRecurringJob(db: Db): () => void {
  const tick = () => runRecurring(db).catch((e) => console.error("recurring job failed", e instanceof Error ? e.message : e));
  void tick();
  const timer = setInterval(tick, 30 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
