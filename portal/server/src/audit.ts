import type { Db } from "./db";
import { auditLog } from "./db/schema";

export type AuditEntry = {
  actorUserId?: string | null;
  clientId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
};

/** Audit failures must never break the request, but they are logged. */
export async function audit(db: Db, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId ?? null,
      clientId: entry.clientId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
