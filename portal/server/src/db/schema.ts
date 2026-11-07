import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ---------- Enums ---------- */
export const roleEnum = pgEnum("role", ["ADMIN", "CLIENT"]);
export const clientStatusEnum = pgEnum("client_status", ["ACTIVE", "PAUSED", "ARCHIVED"]);
export const linkTypeEnum = pgEnum("link_type", [
  "SOCIAL_PROFILES",
  "GOOGLE_DRIVE",
  "MEETING_NOTES",
  "PROPOSALS",
  "PINTEREST",
  "CONTENT_CALENDAR",
  "WORKSHOP",
  "INSPO",
  "SHOT_LIST",
]);
export const folderEnum = pgEnum("file_folder", [
  "AGREEMENTS",
  "INVOICES",
  "REPORTS",
  "SOCIAL_STRATEGY",
  "SHOOT_PLANNING",
]);
export const postStatusEnum = pgEnum("post_status", [
  "DRAFT",
  "AWAITING_APPROVAL",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "POSTED",
]);
export const taskOwnerEnum = pgEnum("task_owner", ["AGENCY", "CLIENT"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ---------- Identity ---------- */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: clientStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("clients_slug_uq").on(t.slug)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(), // always stored lower-case
    name: text("name").notNull(),
    role: roleEnum("role").notNull(),
    // A client user belongs to exactly one client in v1. Admins have no client.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_client_idx").on(t.clientId)],
);

export const loginTokens = pgTable(
  "login_tokens",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("login_tokens_hash_uq").on(t.tokenHash), index("login_tokens_user_idx").on(t.userId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_hash_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/* ---------- Client-owned content (every table carries client_id) ---------- */
const clientRef = () =>
  uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" });

export const linkItems = pgTable(
  "link_items",
  {
    id: id(),
    clientId: clientRef(),
    type: linkTypeEnum("type").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("link_items_client_idx").on(t.clientId)],
);

export const fileItems = pgTable(
  "file_items",
  {
    id: id(),
    clientId: clientRef(),
    folder: folderEnum("folder").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    note: text("note"),
    itemDate: date("item_date"),
    createdAt: createdAt(),
  },
  (t) => [index("file_items_client_idx").on(t.clientId)],
);

export const posts = pgTable(
  "posts",
  {
    id: id(),
    clientId: clientRef(),
    publishDate: date("publish_date").notNull(),
    platform: text("platform").notNull(),
    pillar: text("pillar"),
    format: text("format"),
    caption: text("caption").notNull().default(""),
    assetUrl: text("asset_url"),
    status: postStatusEnum("status").notNull().default("DRAFT"),
    internalNote: text("internal_note"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_client_idx").on(t.clientId, t.publishDate)],
);

export const postEvents = pgTable(
  "post_events",
  {
    id: id(),
    clientId: clientRef(),
    postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: postStatusEnum("from_status"),
    toStatus: postStatusEnum("to_status").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("post_events_post_idx").on(t.postId)],
);

export const ideas = pgTable(
  "ideas",
  {
    id: id(),
    clientId: clientRef(),
    title: text("title").notNull(),
    note: text("note"),
    url: text("url"),
    pillar: text("pillar"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("ideas_client_idx").on(t.clientId)],
);

export const moodItems = pgTable(
  "mood_items",
  {
    id: id(),
    clientId: clientRef(),
    imageUrl: text("image_url").notNull(),
    caption: text("caption"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("mood_items_client_idx").on(t.clientId)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    clientId: clientRef(),
    title: text("title").notNull(),
    dueDate: date("due_date"),
    owner: taskOwnerEnum("owner").notNull().default("AGENCY"),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_client_idx").on(t.clientId)],
);

export const notices = pgTable(
  "notices",
  {
    id: id(),
    clientId: clientRef(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("notices_client_idx").on(t.clientId)],
);

/* ---------- Audit ---------- */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_client_idx").on(t.clientId, t.createdAt)],
);
