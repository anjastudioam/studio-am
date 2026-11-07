/**
 * Module registry: the single description of every agency module that is stored in the `records` table.
 * The server validates against it and the interface builds its lists, boards and forms from it,
 * so adding a field or a status is a change here and nowhere else.
 */
export type FieldType = "text" | "longtext" | "url" | "date" | "select" | "number" | "rating" | "checkbox" | "tags";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  hint?: string;
  /** Takes the full width of the form. */
  wide?: boolean;
};

export type Tone = "neutral" | "info" | "warn" | "ok" | "bad";
export type StatusDef = { key: string; label: string; tone: Tone };

export type SummaryTile = { label: string; statuses?: string[]; overdue?: boolean; kind: "count" | "amount" };

export type ModuleDef = {
  key: string;
  label: string;
  singular: string;
  /** Where the module lives in the interface. */
  route: string;
  client: "required" | "optional";
  titleLabel: string;
  statuses?: StatusDef[];
  /** Statuses that still need work; used for "overdue" and the calendar. */
  open?: string[];
  dateLabel?: string;
  dateRequired?: boolean;
  amountLabel?: string;
  amountRequired?: boolean;
  fields: FieldDef[];
  /** Field keys shown as columns in the list, after the title. */
  columns: string[];
  board?: boolean;
  actions?: { key: string; label: string }[];
  summary?: SummaryTile[];
  /** Calendar feed: show this module's dated records on the agency calendar. */
  calendar?: boolean;
  empty: string;
};

const S = (key: string, label: string, tone: Tone = "neutral"): StatusDef => ({ key, label, tone });

const PRIORITY = ["Low", "Normal", "High", "Urgent"];
const SERVICES = ["Branding", "Social media", "Website", "Marketing", "Audit", "Consulting", "Other"];
const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Pinterest", "X", "Other"];

export const MODULES: ModuleDef[] = [
  {
    key: "projects",
    label: "Projects",
    singular: "project",
    route: "/admin/projects",
    client: "required",
    titleLabel: "Project name",
    statuses: [S("PLANNING", "Planning", "info"), S("ACTIVE", "Active", "ok"), S("ON_HOLD", "On hold", "warn"), S("COMPLETED", "Completed"), S("CANCELLED", "Cancelled", "bad")],
    open: ["PLANNING", "ACTIVE", "ON_HOLD"],
    dateLabel: "Due date",
    amountLabel: "Project fee (R)",
    fields: [
      { key: "type", label: "Service", type: "select", options: SERVICES },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY },
      { key: "startDate", label: "Start date", type: "date" },
      { key: "description", label: "Scope and goals", type: "longtext", wide: true },
      { key: "deliverables", label: "Deliverables", type: "longtext", wide: true, hint: "One per line." },
      { key: "milestones", label: "Milestones", type: "longtext", wide: true, hint: "One per line, with a date if you have one." },
    ],
    columns: ["client", "type", "priority", "status", "date"],
    board: true,
    calendar: true,
    summary: [
      { label: "Active", statuses: ["ACTIVE"], kind: "count" },
      { label: "Planning", statuses: ["PLANNING"], kind: "count" },
      { label: "Overdue", overdue: true, kind: "count" },
    ],
    empty: "No projects yet. Add one when a client signs off on a piece of work.",
  },
  {
    key: "ideas",
    label: "Idea Bank",
    singular: "idea",
    route: "/admin/ideas",
    client: "optional",
    titleLabel: "Idea",
    statuses: [S("IDEA", "Idea", "info"), S("CONSIDERING", "Considering", "warn"), S("APPROVED", "Approved", "ok"), S("DONE", "Done"), S("PARKED", "Parked")],
    open: ["IDEA", "CONSIDERING", "APPROVED"],
    fields: [
      { key: "category", label: "Category", type: "select", options: ["Content", "Campaign", "Brand", "Website", "Agency", "Other"] },
      { key: "priority", label: "Priority", type: "select", options: PRIORITY },
      { key: "url", label: "Reference link", type: "url" },
      { key: "details", label: "Details", type: "longtext", wide: true },
    ],
    columns: ["client", "category", "priority", "status"],
    board: true,
    actions: [
      { key: "toTask", label: "Turn into a to-do" },
      { key: "toProject", label: "Turn into a project" },
    ],
    empty: "No ideas yet. Capture them here so nothing gets lost, then turn the good ones into work.",
  },
  {
    key: "brand",
    label: "Brand Management",
    singular: "brand profile",
    route: "/admin/brand",
    client: "required",
    titleLabel: "Profile name",
    statuses: [S("DRAFT", "Draft", "warn"), S("IN_REVIEW", "In review", "info"), S("APPROVED", "Approved", "ok")],
    fields: [
      { key: "positioning", label: "Positioning", type: "longtext", wide: true },
      { key: "audience", label: "Target audience", type: "longtext", wide: true },
      { key: "personality", label: "Brand personality and tone of voice", type: "longtext", wide: true },
      { key: "values", label: "Values and key messages", type: "longtext", wide: true },
      { key: "colours", label: "Colours", type: "text", hint: "Names and hex codes, e.g. Teal #1D9E9A." },
      { key: "fonts", label: "Fonts", type: "text" },
      { key: "logoUrl", label: "Logo files link", type: "url" },
      { key: "guidelinesUrl", label: "Brand guidelines link", type: "url" },
      { key: "dos", label: "Do and don't", type: "longtext", wide: true },
      { key: "competitors", label: "Competitors and differentiation", type: "longtext", wide: true },
    ],
    columns: ["client", "status", "colours"],
    empty: "No brand profiles yet. One per client keeps positioning, voice and assets in one place.",
  },
  {
    key: "accounts",
    label: "Social accounts",
    singular: "social account",
    route: "/admin/social",
    client: "required",
    titleLabel: "Account name",
    statuses: [S("ACTIVE", "Active", "ok"), S("PAUSED", "Paused", "warn"), S("INACTIVE", "Inactive")],
    fields: [
      { key: "platform", label: "Platform", type: "select", options: PLATFORMS, required: true },
      { key: "username", label: "Username", type: "text" },
      { key: "url", label: "Profile link", type: "url" },
      { key: "followers", label: "Followers", type: "number" },
      { key: "strategy", label: "Content strategy and pillars", type: "longtext", wide: true },
      { key: "audience", label: "Target audience", type: "longtext", wide: true },
      { key: "loginRef", label: "Where the login is kept", type: "text", hint: "For example, the Bitwarden vault name. Never type a password here." },
    ],
    columns: ["client", "platform", "username", "followers", "status"],
    empty: "No social accounts yet. Add each client's profiles so strategy and links live in one place.",
  },
  {
    key: "captions",
    label: "Caption bank",
    singular: "caption",
    route: "/admin/social",
    client: "optional",
    titleLabel: "Caption name",
    fields: [
      { key: "platform", label: "Platform", type: "select", options: PLATFORMS },
      { key: "category", label: "Type", type: "select", options: ["Promo", "Educational", "Behind the scenes", "Engagement", "Announcement", "Testimonial", "Other"] },
      { key: "text", label: "Caption", type: "longtext", wide: true, required: true },
    ],
    columns: ["client", "platform", "category"],
    empty: "No saved captions yet. Keep the ones that work so they can be reused and adapted.",
  },
  {
    key: "hashtags",
    label: "Hashtag bank",
    singular: "hashtag set",
    route: "/admin/social",
    client: "optional",
    titleLabel: "Set name",
    fields: [
      { key: "platform", label: "Platform", type: "select", options: PLATFORMS },
      { key: "category", label: "Topic", type: "text" },
      { key: "tags", label: "Hashtags", type: "longtext", wide: true, required: true, hint: "Separate with spaces." },
    ],
    columns: ["client", "platform", "category"],
    empty: "No hashtag sets yet. Group them by topic so a post takes seconds to tag.",
  },
  {
    key: "websites",
    label: "Website Management",
    singular: "website",
    route: "/admin/websites",
    client: "required",
    titleLabel: "Site name",
    statuses: [S("LIVE", "Live", "ok"), S("IN_BUILD", "In build", "info"), S("REDESIGN", "Redesign", "warn"), S("MAINTENANCE", "Maintenance"), S("OFFLINE", "Offline", "bad")],
    open: ["LIVE", "IN_BUILD", "REDESIGN", "MAINTENANCE"],
    dateLabel: "Renewal date",
    amountLabel: "Annual hosting and care fee (R)",
    fields: [
      { key: "url", label: "Website address", type: "url", required: true },
      { key: "platform", label: "Platform", type: "select", options: ["WordPress", "Shopify", "Wix", "Squarespace", "Webflow", "Custom", "Other"] },
      { key: "registrar", label: "Domain registrar", type: "text" },
      { key: "hosting", label: "Hosting provider", type: "text" },
      { key: "domainExpiry", label: "Domain expires", type: "date" },
      { key: "sslExpiry", label: "SSL expires", type: "date" },
      { key: "loginRef", label: "Where the logins are kept", type: "text", hint: "For example, the Bitwarden vault name. Never type a password here." },
      { key: "notes", label: "Notes and known issues", type: "longtext", wide: true },
    ],
    columns: ["client", "platform", "status", "date"],
    calendar: true,
    summary: [
      { label: "Live", statuses: ["LIVE"], kind: "count" },
      { label: "Renewals overdue", overdue: true, kind: "count" },
    ],
    empty: "No websites yet. Track each client's site, domain and renewal date here.",
  },
  {
    key: "audits",
    label: "Audits & Reporting",
    singular: "audit",
    route: "/admin/audits",
    client: "required",
    titleLabel: "Audit name",
    statuses: [S("DRAFT", "Draft", "warn"), S("IN_PROGRESS", "In progress", "info"), S("DELIVERED", "Delivered", "ok")],
    open: ["DRAFT", "IN_PROGRESS"],
    dateLabel: "Audit date",
    fields: [
      { key: "auditType", label: "Audit type", type: "select", options: ["Brand", "Social media", "Website", "Marketing", "Full"], required: true },
      { key: "scoreStrategy", label: "Strategy (0 to 10)", type: "rating" },
      { key: "scoreConsistency", label: "Consistency (0 to 10)", type: "rating" },
      { key: "scoreQuality", label: "Quality (0 to 10)", type: "rating" },
      { key: "scoreEngagement", label: "Engagement (0 to 10)", type: "rating" },
      { key: "scoreTechnical", label: "Technical (0 to 10)", type: "rating" },
      { key: "scoreConversion", label: "Conversion (0 to 10)", type: "rating" },
      { key: "summary", label: "Executive summary", type: "longtext", wide: true },
      { key: "strengths", label: "Strengths", type: "longtext", wide: true },
      { key: "weaknesses", label: "Weaknesses and gaps", type: "longtext", wide: true },
      { key: "opportunities", label: "Opportunities", type: "longtext", wide: true },
      { key: "recommendations", label: "Recommendations", type: "longtext", wide: true, hint: "One per line. They can become to-dos." },
      { key: "reportUrl", label: "Report link", type: "url" },
    ],
    columns: ["client", "auditType", "overall", "status", "date"],
    calendar: true,
    actions: [{ key: "recommendationsToTasks", label: "Turn recommendations into to-dos" }],
    empty: "No audits yet. Score a client's brand, social, website or marketing and turn the findings into work.",
  },
  {
    key: "meetings",
    label: "Meetings & Notes",
    singular: "meeting",
    route: "/admin/meetings",
    client: "optional",
    titleLabel: "Meeting title",
    statuses: [S("SCHEDULED", "Scheduled", "info"), S("HELD", "Held", "ok"), S("CANCELLED", "Cancelled")],
    open: ["SCHEDULED"],
    dateLabel: "Meeting date",
    fields: [
      { key: "meetingType", label: "Type", type: "select", options: ["Discovery", "Kick-off", "Review", "Strategy", "Internal", "Other"] },
      { key: "attendees", label: "Attendees", type: "text" },
      { key: "agenda", label: "Agenda", type: "longtext", wide: true },
      { key: "notes", label: "Notes", type: "longtext", wide: true },
      { key: "decisions", label: "Decisions", type: "longtext", wide: true },
      { key: "actionItems", label: "Action items", type: "longtext", wide: true, hint: "One per line." },
      { key: "followUp", label: "Follow-up date", type: "date" },
    ],
    columns: ["client", "meetingType", "status", "date"],
    calendar: true,
    actions: [{ key: "actionsToTasks", label: "Turn action items into to-dos" }],
    empty: "No meetings yet. Log notes and decisions, then turn action items into to-dos.",
  },
  {
    key: "files",
    label: "File Repository",
    singular: "file",
    route: "/admin/files",
    client: "optional",
    titleLabel: "File name",
    dateLabel: "File date",
    fields: [
      { key: "url", label: "Link to the file", type: "url", required: true, hint: "A Google Drive or Dropbox link for now. Direct uploads come with the move to your own server." },
      { key: "folder", label: "Folder", type: "select", options: ["Agreements", "Invoices", "Reports", "Strategy", "Brand assets", "Creative", "Shoot planning", "Other"] },
      { key: "version", label: "Version", type: "text" },
      { key: "note", label: "Note", type: "longtext", wide: true },
    ],
    columns: ["client", "folder", "version", "date"],
    empty: "No files yet. Add links to agreements, reports and creative so everything has one home.",
  },
  {
    key: "finance",
    label: "Finance & Invoices",
    singular: "invoice",
    route: "/admin/finance",
    client: "optional",
    titleLabel: "Description",
    statuses: [S("DRAFT", "Draft"), S("SENT", "Sent", "info"), S("PAID", "Paid", "ok"), S("OVERDUE", "Overdue", "bad"), S("CANCELLED", "Cancelled")],
    open: ["SENT", "OVERDUE"],
    dateLabel: "Due date",
    amountLabel: "Amount (R)",
    amountRequired: true,
    fields: [
      { key: "docType", label: "Type", type: "select", options: ["Invoice", "Quote", "Retainer", "Expense"], required: true },
      { key: "number", label: "Number", type: "text" },
      { key: "issueDate", label: "Issue date", type: "date" },
      { key: "paidDate", label: "Paid on", type: "date" },
      { key: "pdfUrl", label: "Link to the document", type: "url" },
      { key: "note", label: "Note", type: "longtext", wide: true },
    ],
    columns: ["client", "docType", "number", "amount", "status", "date"],
    calendar: true,
    summary: [
      { label: "Outstanding", statuses: ["SENT", "OVERDUE"], kind: "amount" },
      { label: "Overdue", overdue: true, kind: "amount" },
      { label: "Paid", statuses: ["PAID"], kind: "amount" },
    ],
    empty: "No invoices or quotes yet. Track what you have sent, what is paid and what is late.",
  },
  {
    key: "recurring",
    label: "Recurring work",
    singular: "recurring rule",
    route: "/admin/recurring",
    client: "required",
    titleLabel: "What to create",
    statuses: [S("ACTIVE", "Active", "ok"), S("PAUSED", "Paused")],
    open: [],
    dateLabel: "Next run",
    dateRequired: true,
    amountLabel: "Invoice amount (R)",
    fields: [
      { key: "kind", label: "Creates a", type: "select", options: ["To-do", "Invoice", "Post idea"], required: true },
      { key: "frequency", label: "Repeats", type: "select", options: ["Weekly", "Monthly"], required: true },
      { key: "monthDay", label: "Day of the month", type: "select", options: ["1", "5", "10", "15", "20", "25", "28", "Last day"], hint: "Monthly rules only. Weekly rules repeat on the weekday of the next run date." },
      { key: "terms", label: "Payment terms for invoices", type: "select", options: ["7 days", "14 days", "30 days"], hint: "Invoices are created as drafts for you to check and send." },
      { key: "priority", label: "To-do priority", type: "select", options: PRIORITY },
      { key: "platform", label: "Post platform", type: "select", options: PLATFORMS },
      { key: "lastRun", label: "Last created", type: "date", hint: "Filled in automatically." },
      { key: "note", label: "Note", type: "longtext", wide: true, hint: "Use {month} in the name to add the month, for example Monthly report: {month}." },
    ],
    columns: ["client", "kind", "frequency", "status", "date"],
    summary: [{ label: "Active rules", statuses: ["ACTIVE"], kind: "count" }],
    actions: [],
    empty: "Nothing repeats yet. Add monthly reports, retainer invoices or weekly planning once and they create themselves.",
  },
  {
    key: "leads",
    label: "Leads & Prospects",
    singular: "lead",
    route: "/admin/leads",
    client: "optional",
    titleLabel: "Business or person",
    statuses: [S("NEW", "New", "info"), S("CONTACTED", "Contacted", "info"), S("MEETING", "Meeting booked", "warn"), S("PROPOSAL", "Proposal sent", "warn"), S("WON", "Won", "ok"), S("LOST", "Lost", "bad")],
    open: ["NEW", "CONTACTED", "MEETING", "PROPOSAL"],
    dateLabel: "Next follow-up",
    amountLabel: "Estimated value (R)",
    fields: [
      { key: "contactName", label: "Contact name", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "source", label: "Where they came from", type: "select", options: ["Referral", "Instagram", "Facebook", "LinkedIn", "Website", "Event", "Walk-in", "Other"] },
      { key: "interest", label: "Interested in", type: "select", options: SERVICES },
      { key: "notes", label: "Notes", type: "longtext", wide: true },
    ],
    columns: ["contactName", "interest", "amount", "status", "date"],
    board: true,
    calendar: true,
    actions: [{ key: "convertLead", label: "Convert to client" }],
    summary: [
      { label: "Open leads", statuses: ["NEW", "CONTACTED", "MEETING", "PROPOSAL"], kind: "count" },
      { label: "Pipeline value", statuses: ["NEW", "CONTACTED", "MEETING", "PROPOSAL"], kind: "amount" },
      { label: "Follow-ups overdue", overdue: true, kind: "count" },
    ],
    empty: "No leads yet. Add every enquiry and the next step, so nothing goes quiet.",
  },
  {
    key: "resources",
    label: "Resource Library",
    singular: "resource",
    route: "/admin/resources",
    client: "optional",
    titleLabel: "Title",
    fields: [
      { key: "category", label: "Category", type: "select", options: ["Template", "SOP", "Contract", "Pricing", "Tool", "Reference", "Training"] },
      { key: "url", label: "Link", type: "url" },
      { key: "tags", label: "Tags", type: "tags" },
      { key: "description", label: "What it is for", type: "longtext", wide: true },
    ],
    columns: ["category", "tags"],
    empty: "Nothing here yet. Keep templates, procedures and contracts together so the agency runs the same way every time.",
  },
  {
    key: "notices",
    label: "Notice Board",
    singular: "notice",
    route: "/admin/notices",
    client: "optional",
    titleLabel: "Headline",
    dateLabel: "Expires",
    fields: [
      { key: "pinned", label: "Pin to the top", type: "checkbox" },
      { key: "body", label: "Message", type: "longtext", wide: true },
    ],
    columns: ["client", "pinned", "date"],
    empty: "No notices. Use this for things the team should not miss.",
  },
  {
    key: "links",
    label: "Link Stack",
    singular: "link",
    route: "/admin/links",
    client: "optional",
    titleLabel: "Name",
    fields: [
      { key: "url", label: "Link", type: "url", required: true },
      { key: "category", label: "Category", type: "select", options: ["Social profiles", "Google Drive", "Meeting notes", "Proposals", "Pinterest", "Content calendar", "Inspiration", "Shot list", "Tool", "Other"] },
      { key: "note", label: "Note", type: "text" },
    ],
    columns: ["client", "category", "url"],
    empty: "No links yet. Pin the folders, boards and tools you open every day.",
  },
];

export const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

/** Audit scores average to one overall figure, stored with the record. */
export const SCORE_KEYS = ["scoreStrategy", "scoreConsistency", "scoreQuality", "scoreEngagement", "scoreTechnical", "scoreConversion"];
