import { Link, useLocation } from "react-router-dom";
import { PageHead } from "../components/ui";

const PLANNED: Record<string, { title: string; phase: string; lead: string; items: string[] }> = {
  projects: {
    title: "Projects",
    phase: "Phase 1",
    lead: "Every piece of client work as its own project, with tasks, milestones and deliverables attached.",
    items: ["Several independent projects per client", "Status, priority, due dates and progress", "Milestones that appear on the calendar", "Tasks and documents linked to the project"],
  },
  ideas: {
    title: "Idea Bank",
    phase: "Phase 2",
    lead: "Ideas that don't belong to a client yet, plus each client's own idea bank.",
    items: ["Categories, priorities and statuses", "Assign an idea to a client", "Turn an idea into a task or a project"],
  },
  brand: {
    title: "Brand Management",
    phase: "Phase 2",
    lead: "One brand profile per client: the single source of truth for strategy, voice and visual identity.",
    items: ["Story, mission, values, positioning and personas", "Colours, fonts, logos and guidelines", "Competitor research and visual references"],
  },
  social: {
    title: "Social Media",
    phase: "Phase 2",
    lead: "All client content in one workflow, from idea to published.",
    items: ["Seven stages: Idea, In Production, Internal Review, Ready, Scheduled, Published, Archived", "Caption and hashtag banks", "Campaign planning and monthly reporting"],
  },
  websites: {
    title: "Website Management",
    phase: "Phase 3",
    lead: "A register of every client website with renewals and maintenance in view.",
    items: ["Platform, hosting and domain registrar", "Domain and hosting renewal reminders", "Audits, outstanding issues and maintenance notes"],
  },
  audits: {
    title: "Audits & Reporting",
    phase: "Phase 3",
    lead: "Structured brand, social media, website and marketing audits with scores and PDF reports.",
    items: ["Category scores and an overall score out of 100", "Findings and recommendations with priorities", "Turn findings into tasks or projects", "Export a professional PDF report"],
  },
  meetings: {
    title: "Meetings & Notes",
    phase: "Phase 1",
    lead: "Meeting history per client, with action items that become tasks automatically.",
    items: ["Agenda, notes, decisions and attendees", "Action items with owners and due dates", "Follow-up dates on the client timeline"],
  },
  files: {
    title: "File Repository",
    phase: "Phase 4",
    lead: "Every client's documents in one searchable place, in a standard folder structure.",
    items: ["Nine default folders per client", "Upload, preview, download and search", "Needs permanent storage, which arrives with the VPS"],
  },
  finance: {
    title: "Finance & Invoices",
    phase: "Phase 4",
    lead: "Quotes, invoices and payments, with revenue by client and by month.",
    items: ["Invoice statuses from Draft to Paid or Overdue", "Retainers and once-off fees", "Due dates on the calendar"],
  },
  leads: {
    title: "Leads & Prospects",
    phase: "Phase 3",
    lead: "A pipeline for potential clients that converts into a client without retyping.",
    items: ["Stages from New Enquiry to Won or Lost", "Source, estimated value and follow-up dates", "Convert a won lead into a client"],
  },
  resources: {
    title: "Resource Library",
    phase: "Phase 4",
    lead: "Templates and know-how you reuse: proposals, contracts, checklists, audits and SOPs.",
    items: ["Categories, tags and search", "Onboarding checklists", "Audit and reporting templates"],
  },
  notices: {
    title: "Notice Board",
    phase: "Phase 2",
    lead: "Agency-wide announcements, reminders and deadlines, with pinning and expiry dates.",
    items: ["Pinned notices", "Expiry dates", "Each client's own notices stay in the client workspace"],
  },
  links: {
    title: "Link Stack",
    phase: "Phase 2",
    lead: "Your everyday tools and links in one place, plus each client's own link stack.",
    items: ["Design tools, hosting, analytics and AI tools", "Categories and custom labels", "Each client's links stay in the client workspace"],
  },
};

export function PlannedPage() {
  const key = useLocation().pathname.split("/")[2] ?? "";
  const p = PLANNED[key];
  if (!p) return <PageHead title="Not found" lead="That page doesn't exist." />;
  return (
    <div className="panel">
      <div className="planned">
        <span className="phase-chip">Planned for {p.phase}</span>
        <PageHead title={p.title} lead={p.lead} />
        <ul>
          {p.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="muted small">
          This module isn't built yet. See the roadmap in the project documents. <Link className="text-link" to="/admin">Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
