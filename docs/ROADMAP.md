# Studio AM Agency System: Gap Analysis and Roadmap

Status: Draft 1, 7 Nov 2026. Source of requirements: `MASTER-SPEC.md`. Look and feel reference: `Intranet Portal.jpg`.

## 1. What already exists (inspected, not assumed)

| Spec area | Today | Gap |
|---|---|---|
| Sign-in, team, audit log | Done: email and password, 6-month sessions, Team page, audit log | Roles for future staff, Settings page |
| Client directory | Name, slug, status (Active, Paused, Archived) | Spec statuses (Lead to Archived), contact, fees, contract dates, services, logo |
| Content calendar | Per-client posts with a client-approval status flow, one master calendar | Replace with the internal 7-stage workflow, add campaign, content type, media |
| Tasks | Per-client to-dos | One agency-wide task manager: priority, project link, subtasks, kanban, recurring |
| Ideas | Per-client ideas | Categories, priorities, statuses, master idea bank, convert to task or project |
| Link stack, notices | Per-client links and notices | Global link stack, notice expiry |
| Files | Links to files only | Upload, folders, versions (needs storage) |
| Moodboard | Per-client image links | Fold into Brand Profile visual references |
| Not built | | Projects, meetings and notes, leads CRM, audits and PDF reports, website register, brand profile, finance and invoices, resource library, automation, AI drafts |

Client-facing code (client accounts, approval flow) still exists but is switched off. The spec says no client access at all, so it should be removed.

## 2. Decisions needed before building

1. **Look.** The image is light glass on a bright teal and violet gradient. The spec says dark-mode-first with graphite and navy. Recommendation: keep the image's glass layout (left sidebar, top search bar, welcome card, shortcut tiles, widgets) on a deep navy to teal gradient, with a light mode later.
2. **File uploads.** Render's free tier has no permanent disk, so uploaded files would vanish. Recommendation: build file records and folders now using Google Drive links, and switch on real uploads when the VPS (or a storage bucket) is ready.
3. **Client login code.** Recommendation: remove it now, which cuts security surface and complexity.
4. **Credentials.** Recommendation: never store passwords at all. Store only a reference ("in Bitwarden, vault X").
5. **Invoices.** Recommendation: track and attach invoices first. Generating invoices and accounting is a larger build, so decide later whether to use a tool like Wave or Zoho for that.
6. **POPIA.** The free tiers may host data outside South Africa. This is one more reason to move to the VPS before real client personal information goes in. Worth confirming with a professional.

## 3. Data architecture (one connected model)

```
client ─┬─ contacts, services, fees, contract dates, status
        ├─ brand_profile (1:1) ── brand_assets
        ├─ social_accounts, content_items (7-stage workflow), captions, hashtags
        ├─ websites (renewals, audits)
        ├─ projects ── milestones, deliverables ── tasks (subtasks)
        ├─ meetings ── action_items ──> tasks
        ├─ audits ── findings ──> tasks / projects
        ├─ ideas ──> tasks / projects
        ├─ invoices, quotes, payments
        ├─ files / folders, links, timeline_events
lead ──(convert)──> client      resource_library      notices      link_stack (global)
Every client-owned table has client_id (existing isolation layer kept). Demo rows carry is_demo so they can be removed in one click.
```

## 4. Phases (each one tested and usable before the next)

**Phase 0, foundation:** new design system and shell from the reference (grouped sidebar: Workspace, Client Operations, Business Management; top search; welcome card; dashboard), remove client-role code, Settings page, `is_demo` flag.
**Phase 1, core operations:** full Client Directory and profiles, Projects, agency Task Manager (list and kanban), Calendar that pulls from everything, Meetings and Notes (action items become tasks).
**Phase 2, client work:** Social Media Hub with the 7-stage workflow, caption and hashtag banks, client and master Idea Banks (convert to task or project), global and client Link Stack, Brand Profile, Notice Board with expiry.
**Phase 3, growth and quality:** Leads CRM (convert to client), Audits and Reporting with scoring and PDF export, Website register with renewal reminders.
**Phase 4, money and files:** Finance and Invoices, Resource Library, File Repository with uploads (needs the VPS), automation rules, nightly backups.
**Phase 5, later:** AI drafts (always marked draft until you approve).

Each phase is several working sessions. Order can change after Phase 0 and after your wife has used it.
