/**
 * FICTIONAL demo clients so the portal can be tried out. Every demo client has is_demo = true
 * and is removed together with all its data by the Settings page. Never put real client data in them.
 */
import { eq } from "drizzle-orm";
import type { Db } from "./index";
import { clients, fileItems, ideas, linkItems, moodItems, notices, posts, tasks } from "./schema";

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Creates the fictional demo clients, flagged is_demo so they can be removed in one click. Returns false if already loaded. */
export async function seedDemo(db: Db): Promise<boolean> {
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
    mk(-4, "Instagram", "Reel", "Behind the scenes", "5am at the ovens. The smell of fresh sourdough is how every day starts here.", "POSTED"),
    mk(1, "Instagram", "Carousel", "Product", "Meet the festive range. Swipe to see what's baking this December.", "AWAITING_APPROVAL", "Waiting on final product photos"),
    mk(3, "Facebook", "Single image", "Community", "Thank you to everyone who joined our Saturday tasting. Here's what you loved most.", "AWAITING_APPROVAL"),
    mk(6, "Instagram", "Story", "Offer", "This week only: buy two loaves, get a free rusk pack.", "APPROVED"),
    mk(9, "Instagram", "Reel", "Behind the scenes", "How our croissant dough gets its layers.", "CHANGES_REQUESTED"),
    mk(12, "Facebook", "Single image", "Product", "Gift boxes are now open for orders.", "DRAFT", "Draft only, check pricing first"),
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
    clientId: outfit.id, publishDate: iso(2), platform: "Instagram", caption: "Summer range preview.", status: "AWAITING_APPROVAL",
  });
  await db.insert(notices).values({ clientId: outfit.id, title: "Welcome to your portal", body: "Everything for your project lives here.", pinned: true });

  return true;
}
