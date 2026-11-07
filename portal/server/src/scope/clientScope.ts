import { and, asc, desc, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Db } from "../db";
import { fileItems, ideas, linkItems, moodItems, notices, posts, tasks } from "../db/schema";

/**
 * TENANT ISOLATION LAYER
 * ----------------------
 * Every read and write of client-owned data goes through a ClientScope.
 * A scope is created for exactly one client, and every statement it runs is
 * constrained by that client's id. Routes never touch client-owned tables directly.
 * If you add a new client-owned table, register it here and give it a client_id column.
 */
type ScopedTable = PgTable & { id: PgColumn; clientId: PgColumn };

export const RESOURCE_TABLES = {
  links: linkItems,
  files: fileItems,
  posts,
  ideas,
  mood: moodItems,
  tasks,
  notices,
} as const;

export type ResourceName = keyof typeof RESOURCE_TABLES;

const ORDER: Record<ResourceName, (t: any) => any[]> = {
  links: (t) => [asc(t.type), asc(t.sortOrder), asc(t.createdAt)],
  files: (t) => [asc(t.folder), desc(t.createdAt)],
  posts: (t) => [asc(t.publishDate), asc(t.createdAt)],
  ideas: (t) => [desc(t.createdAt)],
  mood: (t) => [desc(t.createdAt)],
  tasks: (t) => [asc(t.done), asc(t.dueDate), asc(t.createdAt)],
  notices: (t) => [desc(t.pinned), desc(t.createdAt)],
};

export type Row = Record<string, any>;

export function createScope(db: Db, clientId: string) {
  const table = (name: ResourceName) => RESOURCE_TABLES[name] as unknown as ScopedTable;
  const mine = (t: ScopedTable) => eq(t.clientId, clientId);

  return {
    clientId,

    async list(name: ResourceName): Promise<Row[]> {
      const t = table(name);
      return (await db
        .select()
        .from(t as any)
        .where(mine(t))
        .orderBy(...ORDER[name](t))) as Row[];
    },

    async get(name: ResourceName, id: string): Promise<Row | null> {
      const t = table(name);
      const rows = await db
        .select()
        .from(t as any)
        .where(and(mine(t), eq(t.id, id)))
        .limit(1);
      return (rows[0] as Row) ?? null;
    },

    async create(name: ResourceName, values: Row): Promise<Row> {
      const t = table(name);
      // clientId is applied last so a caller can never choose another client.
      const rows = (await db
        .insert(t as any)
        .values({ ...values, clientId } as any)
        .returning()) as unknown as Row[];
      return rows[0];
    },

    async update(name: ResourceName, id: string, values: Row): Promise<Row | null> {
      const t = table(name);
      const { id: _i, clientId: _c, ...safe } = values;
      const [row] = await db
        .update(t as any)
        .set(safe as any)
        .where(and(mine(t), eq(t.id, id)))
        .returning();
      return (row as Row) ?? null;
    },

    /** Atomic compare-and-set on a post's status, still confined to this client. */
    async moveStatus(id: string, from: string, to: string): Promise<Row | null> {
      const [row] = await db
        .update(posts)
        .set({ status: to as any, updatedAt: new Date() })
        .where(and(eq(posts.clientId, clientId), eq(posts.id, id), eq(posts.status, from as any)))
        .returning();
      return (row as Row) ?? null;
    },

    async remove(name: ResourceName, id: string): Promise<boolean> {
      const t = table(name);
      const rows = await db
        .delete(t as any)
        .where(and(mine(t), eq(t.id, id)))
        .returning({ id: t.id } as any);
      return rows.length > 0;
    },
  };
}

export type ClientScope = ReturnType<typeof createScope>;
