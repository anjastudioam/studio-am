/**
 * FICTIONAL demo clients so the portal can be tried out. Every demo client has is_demo = true
 * and is removed together with all its data by the Settings page. Never put real client data in them.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { clients, fileItems, ideas, linkItems, moodItems, notices, posts, records, tasks, timeEntries } from "./schema";

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Creates the fictional demo clients, flagged is_demo so they can be removed in one click. Returns false if already loaded. */
export async function seedDemo(db: Db, userId?: string): Promise<boolean> {
  const existing = await db.select().from(clients).where(eq(clients.slug, "sunrise-bakery"));
  if (existing.length > 0) {
    return false;
  }

  const [bakery] = await db.insert(clients).values({ name: "Sunrise Bakery (demo)", slug: "sunrise-bakery", isDemo: true }).returning();
  const [outfit] = await db.insert(clients).values({ name: "Karoo Outfitters (demo)", slug: "karoo-outfitters", isDemo: true }).returning();

  const id = bakery.id;
  await db.insert(linkItems).values([
    { clientId: id, type: "SOCIAL_PROFILES", title: "Instagram", url: "https://instagram.com/example" },
    { clientId: id, type: "SOCIAL_PROFILES", title: "Facebook page", url: "https://facebook.com/example" },
    { clientId: id, type: "GOOGLE_DRIVE", title: "Sunrise Bakery shared folder", url: "https://drive.google.com/example" },
    { clientId: id, type: "MEETING_NOTES", title: "Kick-off workshop notes", url: "https://docs.google.com/example-notes" },
    { clientId: id, type: "PROPOSALS", title: "Social media proposal", url: "https://docs.google.com/example-proposal" },
    { clientId: id, type: "PINTEREST", title: "Brand inspiration board", url: "https://pinterest.com/example" },
    { clientId: id, type: "SHOT_LIST", title: "November shoot list", url: "https://docs.google.com/example-shotlist" },
  ]);
  await db.insert(fileItems).values([
    { clientId: id, folder: "AGREEMENTS", title: "Retainer agreement 2026", url: "https://drive.google.com/example-agreement", itemDate: iso(-30) },
    { clientId: id, folder: "INVOICES", title: "Invoice 0012, November", url: "https://drive.google.com/example-invoice", itemDate: iso(-3), note: "Due in 14 days" },
    { clientId: id, folder: "REPORTS", title: "October performance report", url: "https://drive.google.com/example-report", itemDate: iso(-6) },
    { clientId: id, folder: "SOCIAL_STRATEGY", title: "Social strategy, Q4", url: "https://drive.google.com/example-strategy", itemDate: iso(-20) },
    { clientId: id, folder: "SHOOT_PLANNING", title: "Product shoot plan", url: "https://drive.google.com/example-shoot", itemDate: iso(-2) },
  ]);
  const mk = (n: number, platform: string, format: string, pillar: string, caption: string, status: any, internalNote?: string) => ({
    clientId: id, publishDate: iso(n), platform, format, pillar, caption, status, internalNote,
  });
  await db.insert(posts).values([
    mk(-4, "Instagram", "Reel", "Behind the scenes", "5am at the ovens. The smell of fresh sourdough is how every day starts here.", "PUBLISHED"),
    mk(1, "Instagram", "Carousel", "Product", "Meet the festive range. Swipe to see what's baking this December.", "INTERNAL_REVIEW", "Waiting on final product photos"),
    mk(3, "Facebook", "Single image", "Community", "Thank you to everyone who joined our Saturday tasting. Here's what you loved most.", "INTERNAL_REVIEW"),
    mk(6, "Instagram", "Story", "Offer", "This week only: buy two loaves, get a free rusk pack.", "READY"),
    mk(9, "Instagram", "Reel", "Behind the scenes", "How our croissant dough gets its layers.", "IN_PRODUCTION"),
    mk(12, "Facebook", "Single image", "Product", "Gift boxes are now open for orders.", "IDEA", "Draft only, check pricing first"),
  ]);
  await db.insert(ideas).values([
    { clientId: id, title: "Meet the baker series", note: "Short intro video for each team member.", pillar: "Behind the scenes" },
    { clientId: id, title: "Customer favourites poll", note: "Let followers vote on next month's special.", pillar: "Community" },
  ]);
  await db.insert(moodItems).values([
    { clientId: id, imageUrl: "https://placehold.co/600x800/AEA114/ffffff?text=Warm+tones", caption: "Warm, golden light", tags: ["light", "warm"] },
    { clientId: id, imageUrl: "https://placehold.co/600x450/6B6410/ffffff?text=Rustic+wood", caption: "Rustic surfaces", tags: ["texture"] },
    { clientId: id, imageUrl: "https://placehold.co/600x600/F4F2D2/1D1D14?text=Flour+dust", caption: "Flour dust and movement", tags: ["motion"] },
  ]);
  await db.insert(tasks).values([
    { clientId: id, title: "Send high-resolution logo files", owner: "CLIENT", dueDate: iso(2) },
    { clientId: id, title: "Approve November content plan", owner: "CLIENT", dueDate: iso(-1) },
    { clientId: id, title: "Book product shoot date", owner: "AGENCY", dueDate: iso(5) },
    { clientId: id, title: "Set up Instagram shop", owner: "AGENCY", done: true, doneAt: new Date() },
  ]);
  await db.insert(notices).values([
    { clientId: id, title: "Product shoot confirmed for 20 November", body: "We'll be at the bakery from 6am. Please have the festive range ready by 7.", pinned: true },
    { clientId: id, title: "October report is ready", body: "Reach grew across both platforms. Details are in the Reports folder.", pinned: false },
  ]);

  await db.insert(posts).values({
    clientId: outfit.id, publishDate: iso(2), platform: "Instagram", caption: "Summer range preview.", status: "INTERNAL_REVIEW",
  });
  await db.insert(notices).values({ clientId: outfit.id, title: "Welcome to your portal", body: "Everything for your project lives here.", pinned: true });

  const R = (module: string, title: string, o: { client?: string; status?: string; date?: number; amount?: number; data?: Record<string, unknown> } = {}) => ({
    module, title, clientId: o.client ?? null, status: o.status ?? null, date: o.date == null ? null : iso(o.date), amountCents: o.amount == null ? null : o.amount * 100, data: o.data ?? {}, isDemo: true,
  });
  const B = bakery.id;
  const K = outfit.id;
  await db.insert(records).values([
    R("projects", "Brand refresh and new packaging", { client: B, status: "ACTIVE", date: 21, amount: 18500, data: { type: "Branding", priority: "High", description: "Refresh the logo, colours and packaging for the festive range.", deliverables: "Logo options\nColour palette\nPackaging mock-ups", milestones: "Concepts approved\nFinal files delivered" } }),
    R("projects", "Website rebuild", { client: B, status: "PLANNING", date: 60, amount: 32000, data: { type: "Website", priority: "Normal" } }),
    R("projects", "Summer campaign", { client: K, status: "ACTIVE", date: -3, amount: 12000, data: { type: "Marketing", priority: "Urgent" } }),
    R("projects", "Social media setup", { client: K, status: "COMPLETED", date: -20, amount: 6500, data: { type: "Social media" } }),
    R("ideas", "Meet the baker video series", { client: B, status: "CONSIDERING", data: { category: "Content", priority: "High", details: "Short intro video for each team member." } }),
    R("ideas", "Monthly behind-the-scenes day", { status: "IDEA", data: { category: "Agency", priority: "Normal", details: "Film one client a month for a case study." } }),
    R("brand", "Sunrise Bakery brand profile", { client: B, status: "IN_REVIEW", data: { positioning: "The neighbourhood bakery that still bakes at 5am.", audience: "Local families and office workers within 10 km.", personality: "Warm, proud, a little cheeky. Plain words, no jargon.", colours: "Golden #AEA114, Cream #F4F2D2, Walnut #6B6410", fonts: "Jost, Georgia", dos: "Show hands and flour.\nUse real staff.\nAvoid stock photos." } }),
    R("accounts", "Sunrise Bakery Instagram", { client: B, status: "ACTIVE", data: { platform: "Instagram", username: "@sunrisebakery", url: "https://instagram.com/example", followers: 4820, strategy: "Daily stories, three reels a week, one carousel." } }),
    R("accounts", "Sunrise Bakery Facebook", { client: B, status: "ACTIVE", data: { platform: "Facebook", username: "Sunrise Bakery", followers: 2150 } }),
    R("captions", "Fresh out the oven", { client: B, data: { platform: "Instagram", category: "Promo", text: "Still warm. Come early, they go fast. Tag someone who needs a croissant today." } }),
    R("hashtags", "Bakery basics", { client: B, data: { platform: "Instagram", category: "Bakery", tags: "#sourdough #freshbread #localbakery #capetownfood" } }),
    R("websites", "sunrisebakery.example", { client: B, status: "LIVE", date: 40, amount: 3600, data: { url: "https://sunrisebakery.example", platform: "WordPress", registrar: "Domains Co", hosting: "Shared hosting", domainExpiry: iso(40), notes: "Contact form email needs checking." } }),
    R("websites", "karoooutfitters.example", { client: K, status: "REDESIGN", date: -4, amount: 4200, data: { url: "https://karoooutfitters.example", platform: "Shopify" } }),
    R("audits", "Social media audit, Q4", { client: B, status: "DELIVERED", date: -10, data: { auditType: "Social media", scoreStrategy: 6, scoreConsistency: 7, scoreQuality: 8, scoreEngagement: 5, scoreTechnical: 7, scoreConversion: 4, summary: "Strong visuals, weak calls to action.", strengths: "Consistent look.\nGood product photography.", weaknesses: "No posting rhythm.\nNo link in bio strategy.", opportunities: "Reels about the baking process.", recommendations: "Set a three-posts-a-week rhythm\nAdd a link-in-bio page\nStart a weekly reel" } }),
    R("meetings", "Kick-off: festive range", { client: B, status: "HELD", date: -6, data: { meetingType: "Kick-off", attendees: "Thandi, Anja", notes: "Client wants a warmer, more handmade feel.", decisions: "Go with photography over illustration.", actionItems: "Send the shoot brief\nBook product shoot date\nShare moodboard" } }),
    R("meetings", "Content review", { client: B, status: "SCHEDULED", date: 4, data: { meetingType: "Review", agenda: "November content plan." } }),
    R("files", "Retainer agreement 2026", { client: B, data: { url: "https://drive.google.com/example-agreement", folder: "Agreements", version: "v2" }, date: -30 }),
    R("finance", "November retainer", { client: B, status: "SENT", date: 9, amount: 8500, data: { docType: "Invoice", number: "INV-0012" } }),
    R("finance", "October retainer", { client: B, status: "PAID", date: -20, amount: 8500, data: { docType: "Invoice", number: "INV-0011" } }),
    R("finance", "Summer campaign deposit", { client: K, status: "SENT", date: -6, amount: 6000, data: { docType: "Invoice", number: "INV-0013" } }),
    R("finance", "Website rebuild quote", { client: B, status: "DRAFT", amount: 32000, data: { docType: "Quote", number: "Q-0007" } }),
    R("leads", "Fynbos Café", { status: "PROPOSAL", date: 3, amount: 15000, data: { contactName: "Lerato", email: "lerato@fynbos.example", interest: "Branding", source: "Referral", notes: "Wants a full rebrand before spring." } }),
    R("leads", "Table Bay Fitness", { status: "MEETING", date: -2, amount: 9000, data: { contactName: "Marc", interest: "Social media", source: "Instagram" } }),
    R("leads", "Greenline Plumbing", { status: "NEW", date: 1, amount: 4000, data: { interest: "Website", source: "Website" } }),
    R("resources", "Client onboarding questionnaire", { data: { category: "Template", url: "https://docs.google.com/example-questionnaire", tags: ["onboarding", "client"], description: "Send this before the kick-off meeting." } }),
    R("resources", "Social media proposal template", { data: { category: "Template", tags: ["proposal"], description: "Our standard scope and pricing layout." } }),
    R("notices", "Monthly reports go out on the 5th", { data: { pinned: true, body: "Please finish client reports by the 3rd." } }),
    R("links", "Brand asset library", { data: { url: "https://drive.google.com/example-assets", category: "Google Drive" } }),
  ]);

  // Repeating work and logged time, so those screens are not empty.
  await db.update(clients).set({ profile: { monthlyFee: 8500, services: ["Social media", "Branding"], contactName: "Naledi Dlamini" } }).where(eq(clients.id, B));
  await db.update(clients).set({ profile: { monthlyFee: 6000, services: ["Social media"], contactName: "Pieter van Wyk" } }).where(eq(clients.id, K));
  await db.insert(records).values([
    { ...R("recurring", "Sunrise Bakery retainer, {month}", { client: B, status: "ACTIVE", date: 24, amount: 8500, data: { kind: "Invoice", frequency: "Monthly", monthDay: "1", terms: "7 days" } }) },
    { ...R("recurring", "Monthly report: Sunrise Bakery ({month})", { client: B, status: "ACTIVE", date: 20, data: { kind: "To-do", frequency: "Monthly", monthDay: "28", priority: "Normal" } }) },
    { ...R("recurring", "Plan next week's content: Karoo Outfitters", { client: K, status: "ACTIVE", date: 2, data: { kind: "To-do", frequency: "Weekly", priority: "Normal" } }) },
  ]);
  if (userId) {
    const t = (client: string, daysAgo: number, minutes: number, note: string) => ({ clientId: client, userId, workDate: iso(-daysAgo), minutes, note });
    await db.insert(timeEntries).values([
      t(B, 1, 150, "Content calendar and captions"), t(B, 3, 120, "Photo edits"), t(B, 5, 90, "Client call and notes"), t(B, 8, 180, "Packaging concepts"), t(B, 12, 240, "Brand workshop prep"),
      t(K, 2, 300, "Website banner and landing page"), t(K, 4, 360, "Summer campaign creative"), t(K, 6, 240, "Reels edit"), t(K, 9, 270, "Strategy session and report"), t(K, 13, 210, "Shoot planning"),
    ]);
  }

  return true;
}
