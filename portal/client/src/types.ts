export type Role = "ADMIN" | "CLIENT";
export type User = { id: string; email: string; name: string; role: Role; clientId: string | null };
export type MeClient = { id: string; name: string; slug: string };

export type PostStatus = "DRAFT" | "AWAITING_APPROVAL" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "POSTED";
export type Post = {
  id: string;
  publishDate: string;
  platform: string;
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
export type Task = { id: string; title: string; dueDate: string | null; owner: "AGENCY" | "CLIENT"; done: boolean };
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

export type AdminClient = { id: string; name: string; slug: string; status: "ACTIVE" | "PAUSED" | "ARCHIVED"; awaitingApproval: number; openTasks: number };
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
export const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting approval",
  CHANGES_REQUESTED: "Changes requested",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  POSTED: "Posted",
};
export const linkLabel = (v: string) => LINK_TYPES.find((t) => t.value === v)?.label ?? v;
export const folderLabel = (v: string) => FOLDERS.find((t) => t.value === v)?.label ?? v;

export type MasterPost = Post & { clientId: string; clientName: string; clientSlug: string };
export type MasterTask = { id: string; clientId: string; clientName: string; clientSlug: string; title: string; dueDate: string | null; owner: "AGENCY" | "CLIENT"; done: boolean };
