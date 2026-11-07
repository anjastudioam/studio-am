export type Role = "ADMIN" | "CLIENT";
export type User = { id: string; email: string; name: string; role: Role; clientId: string | null };
export type MeClient = { id: string; name: string; slug: string };

export type PostStatus = "IDEA" | "IN_PRODUCTION" | "INTERNAL_REVIEW" | "READY" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" | "DRAFT" | "AWAITING_APPROVAL" | "CHANGES_REQUESTED" | "APPROVED" | "POSTED";
export type Post = {
  id: string;
  publishDate: string;
  platform: string;
  title?: string | null;
  campaign?: string | null;
  pillar: string | null;
  format: string | null;
  caption: string;
  assetUrl: string | null;
  status: PostStatus;
  internalNote?: string | null;
};
export type PostEvent = { id: string; actorUserId: string | null; fromStatus: PostStatus | null; toStatus: PostStatus; comment: string | null; createdAt: string };

export type LinkItem = { id: string; type: string; title: string; url: string };
export type FileItem = { id: string; folder: string; title: string; url: string; note: string | null; itemDate: string | null };
export type Idea = { id: string; title: string; note: string | null; url: string | null; pillar: string | null; createdAt: string };
export type MoodItem = { id: string; imageUrl: string; caption: string | null; tags: string[] };
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "DOING" | "DONE";
export type Subtask = { id: string; title: string; done: boolean };
export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];
export const TASK_STATUS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "To do" },
  { value: "DOING", label: "In progress" },
  { value: "DONE", label: "Done" },
];
export type Task = { id: string; title: string; dueDate: string | null; owner: "AGENCY" | "CLIENT"; done: boolean; priority?: Priority; status?: TaskStatus; notes?: string | null; subtasks?: Subtask[] };
export type Notice = { id: string; title: string; body: string; pinned: boolean; createdAt: string };

export type Home = {
  client: { id: string; name: string; slug: string; status: string };
  linkStack: LinkItem[];
  folders: Record<string, number>;
  openTasks: Task[];
  notices: Notice[];
  awaitingApproval: number;
  nextPost: Post | null;
};

export type ClientProfile = { contactName?: string; email?: string; phone?: string; website?: string; industry?: string; address?: string; services?: string[]; monthlyFee?: number; contractStart?: string; contractEnd?: string; notes?: string };
export type ClientStatus = "ACTIVE" | "ONBOARDING" | "PAUSED" | "ARCHIVED";
export const CLIENT_STATUS: Record<ClientStatus, string> = { ONBOARDING: "Onboarding", ACTIVE: "Active", PAUSED: "Paused", ARCHIVED: "Archived" };
export type AdminClient = { id: string; name: string; slug: string; status: ClientStatus; isDemo?: boolean; profile?: ClientProfile; awaitingApproval: number; openTasks: number };
export type AdminUser = { id: string; email: string; name: string; role: Role; active: boolean; lastLoginAt: string | null };
export type AuditRow = { id: string; actorUserId: string | null; clientId: string | null; action: string; entity: string | null; createdAt: string };

export const LINK_TYPES: { value: string; label: string }[] = [
  { value: "SOCIAL_PROFILES", label: "Social profiles" },
  { value: "GOOGLE_DRIVE", label: "Google Drive" },
  { value: "MEETING_NOTES", label: "Meeting notes" },
  { value: "PROPOSALS", label: "Proposals" },
  { value: "PINTEREST", label: "Pinterest page" },
  { value: "CONTENT_CALENDAR", label: "Content calendar" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "INSPO", label: "Inspo" },
  { value: "SHOT_LIST", label: "Shot list" },
];
export const FOLDERS: { value: string; label: string }[] = [
  { value: "AGREEMENTS", label: "Agreements" },
  { value: "INVOICES", label: "Invoices" },
  { value: "REPORTS", label: "Reports" },
  { value: "SOCIAL_STRATEGY", label: "Social strategy" },
  { value: "SHOOT_PLANNING", label: "Shoot planning" },
];
/** The agency's internal content workflow, in order. */
export const STAGES = ["IDEA", "IN_PRODUCTION", "INTERNAL_REVIEW", "READY", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export const STATUS_LABEL: Record<PostStatus, string> = {
  IDEA: "Idea",
  IN_PRODUCTION: "In production",
  INTERNAL_REVIEW: "Internal review",
  READY: "Ready",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
  // Older posts keep working and are shown under the nearest stage.
  DRAFT: "Idea",
  AWAITING_APPROVAL: "Internal review",
  CHANGES_REQUESTED: "In production",
  APPROVED: "Ready",
  POSTED: "Published",
};
export const stageOf = (s: PostStatus): PostStatus => (({ DRAFT: "IDEA", AWAITING_APPROVAL: "INTERNAL_REVIEW", CHANGES_REQUESTED: "IN_PRODUCTION", APPROVED: "READY", POSTED: "PUBLISHED" }) as Partial<Record<PostStatus, PostStatus>>)[s] ?? s;
export const linkLabel = (v: string) => LINK_TYPES.find((t) => t.value === v)?.label ?? v;
export const folderLabel = (v: string) => FOLDERS.find((t) => t.value === v)?.label ?? v;

export type MasterPost = Post & { clientId: string; clientName: string; clientSlug: string };
export type MasterTask = { id: string; clientId: string; clientName: string; clientSlug: string; title: string; dueDate: string | null; owner: "AGENCY" | "CLIENT"; done: boolean; priority: Priority; status: TaskStatus; notes: string | null; subtasks: Subtask[] };
