# MASTER BUILD SPECIFICATION: DIGITAL AGENCY MANAGEMENT SYSTEM

## 1. Project Overview

I am building a private, internal Agency Management System for a creative and digital marketing agency.

The agency provides services including:
- Brand development and rebranding.
- Brand identity and strategy.
- Social media management.
- Social media strategy and content creation.
- Digital marketing and advertising.
- Website design, development, redesign and upgrades.
- Website audits.
- Brand audits.
- Social media audits.
- Marketing strategies and consulting.

The purpose of this platform is to centralise the agency's entire operation into one organised digital environment.

**IMPORTANT: This is an INTERNAL-ONLY platform. Clients will NEVER have access, login credentials or access to any part of the system.**

The platform is exclusively for the agency owner and potentially future agency employees.

It should function as a combination of an Agency Management System, CRM, Project Management System, Digital File Repository and Business Operations Dashboard.

The objective is to manage the complete client lifecycle, from initial enquiry and onboarding to project execution, ongoing management, reporting and client retention.

## 2. Design and User Experience

The platform must have a premium, modern, professional SaaS interface.

Design direction:
- Clean, sophisticated and minimal.
- Dark-mode-first interface.
- Graphite, charcoal and deep navy backgrounds.
- Subtle accent colours.
- Clear typography and strong visual hierarchy.
- Modern cards, dashboards, tables and interactive elements.
- Smooth transitions and subtle animations.
- Well-organised spacing.
- Responsive across desktop, tablet and mobile.

Avoid:
- Generic template-looking dashboards.
- Excessive gradients.
- Unnecessary animations.
- Overcrowded interfaces.
- Excessive use of bright colours.
- Cartoonish icons and visual elements.

The interface should feel like a premium professional agency operating system.

Prioritise usability and information hierarchy over decorative design.

## 3. Main Navigation Structure

Build the following main navigation:

### WORKSPACE
1. Dashboard
2. Client Directory
3. Projects
4. Task Manager
5. Calendar
6. Idea Bank

### CLIENT OPERATIONS
7. Brand Management
8. Social Media Management
9. Website Management
10. Audits & Reporting
11. Meetings & Notes

### BUSINESS MANAGEMENT
12. File Repository
13. Finance & Invoices
14. Leads & Prospects
15. Resource Library
16. Notice Board
17. Link Stack
18. Settings

Navigation should be intuitive, collapsible and consistent throughout the platform.

## 4. Agency HQ – Main Dashboard

The dashboard is the agency's central command centre.

It should provide an immediate overview of everything happening across the business.

Include:

### Key Statistics
- Total active clients.
- New leads.
- Active projects.
- Projects completed.
- Tasks outstanding.
- Overdue tasks.
- Upcoming deadlines.
- Pending client feedback.
- Outstanding invoices.
- Monthly revenue.

### Dashboard Sections

**Today's Focus**
Display all tasks requiring attention today.

**Upcoming Deadlines**
Show approaching project deadlines, content deadlines, contract renewals and other important dates.

**Upcoming Meetings**
Display scheduled meetings with client names, times and meeting details.

**Recent Activity**
Display recent changes and activities throughout the system.

**Client Overview**
Display active clients with their current status and project progress.

**Pending Actions**
Highlight tasks requiring attention, outstanding feedback, overdue invoices and incomplete deliverables.

**Quick Actions**
Provide shortcuts to:
- Add a client.
- Create a project.
- Add a task.
- Schedule a meeting.
- Upload a document.
- Create an idea.
- Add a note.
- Create an invoice.

Include dashboard filters for today, this week, this month and custom date ranges.

## 5. Client Directory and Individual Client Profiles

Create a central Client Directory containing all clients.

Each client must have an individual profile with the following structure.

### A. Client Overview

Information fields:
- Company/business name.
- Company logo.
- Industry.
- Business description.
- Primary contact person.
- Contact email.
- Contact number.
- Website.
- Physical address (optional).
- Social media links.
- Client status.
- Date onboarded.
- Contract start date.
- Contract end date.
- Services purchased.
- Monthly retainer or project fee.
- Internal notes.

Client statuses:
- Lead.
- Onboarding.
- Active.
- On Hold.
- Completed.
- Archived.

Include a visual overview of active projects, outstanding tasks, upcoming meetings, recent activity and outstanding payments.

### B. Brand Profile & Strategy

Create a central repository for all brand information.

Include:
- Brand story.
- Mission.
- Vision.
- Core values.
- Brand positioning.
- Target audience.
- Customer personas.
- Brand personality.
- Tone of voice.
- Competitor analysis.
- Unique selling proposition.
- Key messaging.
- Taglines.
- Brand colours and HEX codes.
- Typography and fonts.
- Logo variations.
- Brand guidelines.
- Visual references.
- Brand assets.

This section must act as the single source of truth for all brand-related work.

### C. Social Media Management

Create a dedicated social media management section.

Include:
- Instagram account details.
- Facebook account details.
- TikTok account details.
- LinkedIn account details.
- YouTube account details.
- Other relevant platforms.
- Profile URLs.
- Username information.
- Content strategy.
- Content pillars.
- Target audience.
- Monthly content calendars.
- Post ideas.
- Caption bank.
- Hashtag bank.
- Reel and video ideas.
- Campaign planning.
- Published content archive.
- Performance statistics.
- Monthly reporting.

Include a content workflow with the following statuses:

1. Idea
2. In Production
3. Internal Review
4. Ready
5. Scheduled
6. Published
7. Archived

Allow content items to include:
- Content title.
- Platform.
- Content type.
- Caption.
- Media attachments.
- Publication date.
- Campaign.
- Content pillar.
- Internal notes.
- Status.

### D. Website Management

Create a dedicated website management section.

Include:
- Website URL.
- Platform/CMS.
- Hosting provider.
- Domain registrar.
- Domain renewal date.
- Hosting renewal date.
- Last website audit.
- Website status.
- Current development projects.
- Outstanding improvements.
- Website maintenance notes.
- SEO information.
- Performance observations.
- Website assets and documentation.

Do not store website passwords in ordinary text fields. Use secure credential storage or external password manager references.

### E. Projects & Services

Each client must support multiple independent projects.

Examples:
- Rebranding project.
- Website redesign.
- Social media management.
- Marketing campaign.
- Brand audit.
- Website audit.

Each project should contain:
- Project title.
- Project description.
- Client.
- Service category.
- Scope of work.
- Start date.
- Due date.
- Project status.
- Priority.
- Deliverables.
- Milestones.
- Assigned tasks.
- Supporting documents.
- Internal notes.
- Progress percentage.
- Completion date.

Project statuses:
- Planning.
- Not Started.
- In Progress.
- Under Review.
- Awaiting Client Feedback.
- On Hold.
- Completed.
- Cancelled.

Allow tasks and deliverables to be linked directly to projects.

### F. Meetings & Notes

Create a meeting management section.

Every meeting should include:
- Meeting title.
- Client.
- Date and time.
- Attendees.
- Meeting type.
- Agenda.
- Discussion notes.
- Decisions made.
- Action items.
- Responsible person.
- Due dates.
- Follow-up date.
- Attachments.

Allow meeting action items to automatically create tasks in the main Task Manager.

Maintain a chronological meeting history per client.

### G. Client Idea Bank

Create a dedicated idea repository for each client.

Categories:
- Branding.
- Social media.
- Content ideas.
- Campaign concepts.
- Website improvements.
- Marketing opportunities.
- Competitor inspiration.
- Future opportunities.

Each idea should support:
- Title.
- Description.
- Category.
- Priority.
- Status.
- Image attachments.
- Reference links.
- Internal notes.
- Date created.

Idea statuses:
- New.
- Exploring.
- Approved.
- In Progress.
- Completed.
- Rejected.

Allow ideas to be converted into tasks or projects.

### H. Client File Repository

Every client must have their own document storage area.

Create the following default folder structure:

01 – Contracts & Agreements
02 – Finance & Invoices
03 – Brand Identity
04 – Social Media
05 – Website
06 – Marketing
07 – Reports & Audits
08 – Meeting Documents
09 – General

Allow:
- Folder creation.
- Subfolders.
- File uploads.
- File previews.
- File downloads.
- File categorisation.
- Search.
- File descriptions.
- Upload dates.
- Version tracking where supported.

All files must be associated with the relevant client and accessible through the central File Repository.

### I. Client Relationship History

Create a chronological activity timeline showing:
- Meetings.
- Important conversations.
- Emails or communication notes.
- Decisions.
- Deliverables.
- Project milestones.
- Client feedback.
- Follow-ups.
- Important events.

Include a Last Contacted date and Next Follow-Up date.

This will help ensure no client relationship is neglected.

### J. Client Finance

Within each client profile, track:
- Agreed fees.
- Monthly retainers.
- Project fees.
- Quotations.
- Invoices.
- Payment status.
- Payment dates.
- Outstanding balances.
- Additional services.
- Revenue generated.

## 6. Agency-Wide Task Manager

Build a central task management system that consolidates all tasks across all clients and projects.

Each task must include:
- Task title.
- Description.
- Related client.
- Related project.
- Assigned person.
- Priority.
- Start date.
- Due date.
- Status.
- Category.
- Subtasks.
- Attachments.
- Notes.

Task statuses:
- Not Started.
- In Progress.
- Waiting.
- Completed.
- Cancelled.

Priority levels:
- Low.
- Medium.
- High.
- Critical.

Include:
- List view.
- Kanban board.
- Calendar view.
- Overdue tasks.
- Tasks due today.
- Upcoming tasks.
- Completed tasks.

Allow filtering by client, project, person, status, priority and date.

Support recurring tasks for ongoing client management.

## 7. Agency Calendar

Create a central calendar containing:
- Client meetings.
- Project deadlines.
- Content publication dates.
- Campaign launches.
- Follow-up reminders.
- Contract renewals.
- Invoice due dates.
- Internal agency events.

Support daily, weekly and monthly views.

Calendar events should link back to the relevant client, project or task.

## 8. Master Idea Bank

In addition to individual client idea banks, create an agency-wide idea repository.

This is for ideas that have not yet been allocated to a specific client.

Include categories, tags, descriptions, attachments, reference links, priorities and statuses.

Allow ideas to be assigned to clients or converted into projects and tasks.

## 9. Brand Management

Create a central area for managing brand-related work across clients.

Include:
- Brand identity projects.
- Brand guidelines.
- Brand assets.
- Brand positioning.
- Competitor research.
- Visual references.
- Brand strategy documents.
- Messaging frameworks.

Ensure that brand information is linked to each client's individual Brand Profile.

## 10. Social Media Management Hub

Create an agency-wide view of all social media work.

Include:
- All client content calendars.
- Upcoming publications.
- Content in production.
- Content awaiting internal review.
- Scheduled content.
- Published content.
- Campaign tracking.

Allow filtering by client, platform, campaign, content type and status.

## 11. Website Management Register

Create a central register of all client websites.

Display:
- Client.
- Website address.
- CMS/platform.
- Hosting provider.
- Website status.
- Last audit date.
- Next maintenance date.
- Domain renewal date.
- Outstanding issues.

Provide reminders for upcoming renewals and maintenance.

## 12. Audits & Reporting Centre

This is an important feature of the agency.

Build a structured audit system with four main audit types.

### Brand Audit
Assess:
- Brand identity.
- Brand positioning.
- Consistency.
- Messaging.
- Target audience.
- Visual identity.
- Competitor differentiation.

### Social Media Audit
Assess:
- Profile optimisation.
- Content quality.
- Posting consistency.
- Engagement.
- Reach.
- Audience.
- Content strategy.
- Competitor performance.

### Website Audit
Assess:
- User experience.
- Design.
- Mobile responsiveness.
- Navigation.
- SEO.
- Loading speed.
- Conversion optimisation.
- Technical issues.

### Marketing Audit
Assess:
- Marketing strategy.
- Target audience.
- Marketing channels.
- Campaign performance.
- Advertising.
- Messaging.
- Conversion.
- Return on investment.

Each audit must include:
- Audit title.
- Client.
- Audit type.
- Date conducted.
- Assessment criteria.
- Category scores.
- Supporting evidence.
- Screenshots and attachments.
- Identified problems.
- Recommendations.
- Priority ratings.
- Overall score.
- Final conclusions.
- Action plan.

Support scoring out of 100 where appropriate.

Allow audit findings to be converted into projects and tasks.

Support generating professional PDF audit reports.

## 13. Finance & Invoices

Create an internal agency financial management area.

Include:
- Client invoices.
- Quotations.
- Payment tracking.
- Outstanding balances.
- Monthly retainers.
- Once-off project fees.
- Revenue by client.
- Revenue by month.
- Expense tracking.
- Payment due dates.

Invoice statuses:
- Draft.
- Issued.
- Paid.
- Partially Paid.
- Overdue.
- Cancelled.

Provide financial dashboard summaries and allow invoices to be uploaded or generated where supported.

## 14. Leads & Prospects CRM

Create a pipeline for managing potential clients.

Lead information:
- Business name.
- Contact person.
- Email.
- Phone number.
- Industry.
- Services interested in.
- Enquiry date.
- Source.
- Estimated deal value.
- Follow-up date.
- Notes.

Pipeline stages:
- New Enquiry.
- Contacted.
- Consultation Scheduled.
- Proposal Sent.
- Negotiation.
- Won.
- Lost.

Allow successful leads to be converted into active clients without re-entering their information.

## 15. Resource Library

Create a central library for reusable agency resources.

Include:
- Proposal templates.
- Contract templates.
- Onboarding checklists.
- Brand audit templates.
- Social media audit templates.
- Website audit templates.
- Marketing audit templates.
- Reporting templates.
- Content planning templates.
- SOPs.
- Design resources.
- Stock imagery references.
- Useful links.

Allow categorisation, tagging and search.

## 16. Notice Board

Create an internal notice board for:
- Important announcements.
- Agency reminders.
- Upcoming events.
- Important deadlines.
- Operational updates.
- General notes.

Support pinned notices and expiry dates.

## 17. Link Stack

Create a central link management area.

Allow the agency owner to save frequently used links, including:
- Design tools.
- Social media platforms.
- Website administration.
- Hosting platforms.
- Marketing tools.
- Analytics.
- AI tools.
- Client-specific links.

Support categories, descriptions and custom labels.

Also include a Link Stack within each individual client profile for that client's relevant platforms and resources.

## 18. Automation and Workflow Engine

Build the system with connected workflows.

Examples:

**When a new client is created:**
- Generate a standard client profile.
- Create the default folder structure.
- Generate an onboarding checklist.
- Create the initial brand profile.
- Add the client to the directory.

**When a new project is created:**
- Generate a project workspace.
- Allow task templates to be applied.
- Link the project to its client.
- Add project milestones to the calendar.

**When a meeting is completed:**
- Allow meeting notes to be recorded.
- Create follow-up tasks.
- Update the client activity timeline.

**When a task deadline approaches:**
- Display reminders.
- Highlight approaching deadlines.

**When a task becomes overdue:**
- Flag it on the dashboard.
- Highlight it in the Task Manager.

**When an invoice is issued:**
- Update financial tracking.
- Add the payment due date to the calendar.

**When an invoice becomes overdue:**
- Flag it in the finance dashboard.

**When an audit is completed:**
- Store the audit.
- Allow a report to be generated.
- Allow recommendations to be converted into tasks and projects.

**When a contract approaches expiry:**
- Display a reminder.

## 19. AI Integration – Future Capability

Prepare the architecture for future AI integration.

Potential functionality:
- Generate social media caption drafts.
- Suggest content ideas.
- Summarise meeting notes.
- Convert meeting notes into action items.
- Assist with brand strategy.
- Analyse audit findings.
- Generate monthly report summaries.
- Suggest improvements based on client performance.
- Identify overdue work.
- Highlight clients requiring attention.

AI-generated outputs must remain drafts until reviewed and approved internally.

Do not make external client-facing changes automatically.

## 20. Security and Permissions

The platform is private and internal.

Requirements:
- Secure authentication.
- Role-based access.
- Administrator permissions.
- Future employee accounts.
- Client-specific data organisation.
- Secure file storage.
- Database-level access controls.
- Audit logs.
- Automated backups.
- POPIA-aligned handling of personal information.

No client-facing accounts or client portal functionality should be built.

Social media passwords and other sensitive credentials must not be stored in plain text.

## 21. Technical Architecture and Development Requirements

Before making major changes, inspect the existing project and understand its current architecture.

Do not unnecessarily rebuild or replace existing working functionality.

Requirements:
- Maintain a scalable and modular architecture.
- Use reusable components.
- Maintain a consistent design system.
- Use a properly structured relational database.
- Establish clear relationships between clients, projects, tasks, meetings, documents, audits and invoices.
- Ensure all information persists in the database.
- Implement proper validation and error handling.
- Implement loading and empty states.
- Implement search, filtering and sorting.
- Ensure responsive layouts.
- Avoid duplicated data.
- Ensure related sections communicate with one another.
- Maintain secure file handling.
- Make future integrations possible.

Do not use mock data as the permanent data source.

Any demo data must be clearly identified and removable.

## 22. Critical Development Approach

Do not attempt to build the entire system in one uncontrolled implementation.

First:
1. Inspect the existing codebase.
2. Understand the existing technology stack.
3. Identify what is already built.
4. Identify what needs to be added.
5. Review the existing database structure.
6. Propose the required database architecture.
7. Identify dependencies and potential technical limitations.

Then create a structured implementation roadmap.

Build in logical modules, ensuring each module works properly before moving on.

Do not break existing functionality.

Do not make assumptions about existing components, database tables or integrations. Inspect them first.

## 23. Final Vision

The end goal is to create a complete, centralised digital operating environment for a creative agency.

The agency owner should be able to open the platform and immediately understand:

- Which clients she manages.
- What work is currently being done.
- What needs to happen next.
- What deadlines are approaching.
- What information is outstanding.
- What opportunities exist.
- What revenue is being generated.
- What needs her attention.

Every client, project, task, document, meeting, audit and financial record should be connected.

The system should reduce administrative work, improve organisation, create accountability and make it easier to scale the agency.

**Build an intelligent, connected agency operating system – not simply a collection of disconnected management pages.**