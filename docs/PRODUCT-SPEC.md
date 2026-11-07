# Studio AM Client Portal: Product Spec (v1)

Status: Draft 1, 7 Nov 2026
Portal address (planned): portal.studio-am.co.za
Repo: github.com/anjastudioam/studio-am

---

## 1. Objective

Give every Studio AM client their own private, branded space where they see the work, approve content, and find everything in one place. Give Studio AM a single admin view across all clients.

## 2. Strategic considerations

- **Brand:** The portal is the client's most frequent touchpoint with Studio AM. It should feel considered and premium, and it should reinforce "where creative thinking meets strategic execution".
- **Retention:** A portal that makes approvals and file-finding easy makes Studio AM harder to replace and easier to renew.
- **Operations:** One template for every client means a consistent process, fast onboarding and less admin.
- **Data:** Approval times, content volume and task completion per client show how the agency is performing.
- **Ecosystem:** The portal shares design tokens and naming with the future Studio AM website.
- **Product potential:** Built cleanly, this could later be offered to other agencies. Nothing in v1 should block that (keep "agency" as a concept, even if there is only one).

## 3. Users and roles

| Role | Who | Can do |
|---|---|---|
| **Admin** | Studio AM team | See and edit every client. Create clients and invite client users. |
| **Client** | A person at a client business | See and edit only their own client's portal, within the limits below. |

Client users can: tick and add to-dos, approve or request changes on posts, add ideas, comment, and view all sections. Client users cannot: delete files or links, see other clients, or change settings. Exact permissions per section are in section 6.

## 4. Information architecture

```
/login                       Magic-link sign-in
/admin                       All clients: awaiting approval, overdue tasks, upcoming posts
/admin/clients/new           Create a client
/admin/clients/:id           Client settings and users
/c/:clientSlug               Client home
/c/:clientSlug/links         Link Stack
/c/:clientSlug/files         File Folders (5 folders)
/c/:clientSlug/files/:folder One folder
/c/:clientSlug/calendar      Content Calendar
/c/:clientSlug/ideas         Idea Bank
/c/:clientSlug/moodboard     Social Moodboard
/c/:clientSlug/tasks         To-Do
/c/:clientSlug/notices       Notice Board
```

### Client home (four blocks, as briefed)

1. **Link Stack:** the most-used links, with "see all".
2. **File Folders:** the five folders with item counts.
3. **To-Do:** open items, tickable inline.
4. **Notice Board:** pinned and latest notices.

Home also shows a thin strip: "N posts awaiting your approval" and "next scheduled post". Content Calendar, Idea Bank and Moodboard are reached from the navigation.

## 5. Sections

### 5.1 Link Stack
Fixed link types, each holding one or more links:
Social Profiles, Google Drive, Meeting Notes, Proposals, Pinterest Page, Content Calendar, Workshop, Inspo, Shot List.

### 5.2 File Folders
Five fixed folders: Agreements, Invoices, Reports, Social Strategy, Shoot Planning.
**v1 stores links to files (Google Drive), not the files themselves.** This keeps the portal light, avoids storage costs, and means nothing needs migrating when the VPS arrives. Each item has a title, URL, optional note and date.

### 5.3 Content Calendar
Month and list views. Each post: date, platform, content pillar, format, caption, creative link, status, internal note.

Statuses: Draft, Awaiting approval, Changes requested, Approved, Scheduled, Posted.
Clients can approve or request changes with a comment. Every status change is recorded (who, when).

### 5.4 Idea Bank
Simple list of ideas with a title, note, optional link and tags (content pillar). Both sides can add. Admin can promote an idea to a calendar post.

### 5.5 Social Moodboard
Grid of image items: image URL, caption and tags. v1 uses image URLs or Pinterest/Drive links. Image upload is out of scope for v1.

### 5.6 To-Do
Checklist items with an optional due date, an owner (Studio AM or client) and a done state.

### 5.7 Notice Board
Short announcements from Studio AM, with pin, date and optional link.

## 6. Permissions

| Section | Client can | Admin can |
|---|---|---|
| Link Stack | View | Add, edit, delete |
| File Folders | View | Add, edit, delete |
| Content Calendar | View, approve, request changes, comment | Everything |
| Idea Bank | View, add, edit own | Everything |
| Moodboard | View, add | Everything |
| To-Do | View, add, tick | Everything |
| Notice Board | View | Add, edit, delete |

## 7. Data model (Prisma-style outline)

```
Agency        id, name                      (one row for now; keeps the door open)
User          id, email (unique), name, role [ADMIN|CLIENT], agencyId, createdAt, lastLoginAt
Client        id, agencyId, name, slug (unique), status [ACTIVE|PAUSED|ARCHIVED], brandColour?, createdAt
ClientUser    id, clientId, userId        (a client user belongs to exactly one client in v1)
LoginToken    id, userId, tokenHash, expiresAt, usedAt
Session       id, userId, tokenHash, expiresAt, ip?, userAgent?

LinkItem      id, clientId, type [SOCIAL_PROFILES|GOOGLE_DRIVE|MEETING_NOTES|PROPOSALS|
                                  PINTEREST|CONTENT_CALENDAR|WORKSHOP|INSPO|SHOT_LIST],
              title, url, sortOrder
FileItem      id, clientId, folder [AGREEMENTS|INVOICES|REPORTS|SOCIAL_STRATEGY|SHOOT_PLANNING],
              title, url, note?, itemDate?, createdAt
Post          id, clientId, publishDate, platform, pillar?, format?, caption, assetUrl?,
              status [DRAFT|AWAITING_APPROVAL|CHANGES_REQUESTED|APPROVED|SCHEDULED|POSTED],
              internalNote?, createdAt, updatedAt
PostEvent     id, postId, actorUserId, fromStatus, toStatus, comment?, createdAt
Idea          id, clientId, title, note?, url?, pillar?, createdByUserId, createdAt
MoodItem      id, clientId, imageUrl, caption?, tags[], createdByUserId, createdAt
Task          id, clientId, title, dueDate?, owner [AGENCY|CLIENT], done, doneAt?, createdAt
Notice        id, clientId, title, body, pinned, createdByUserId, createdAt
AuditLog      id, actorUserId, clientId?, action, entity, entityId, createdAt
```

Every client-owned table carries `clientId`, indexed.

## 8. Security requirements (non-negotiable)

1. **Tenant isolation:** every query for client data is scoped by the client the signed-in user belongs to, enforced in one shared server-side layer, not in each route. Tests prove client A cannot read or write client B's data.
2. **Authentication:** passwordless magic links. Tokens are random, single-use, short-lived (15 minutes), and stored hashed.
3. **Sessions:** HTTP-only, secure, same-site cookies. Server-side session records so they can be revoked.
4. **Authorisation:** role checks on the server for every write. The interface hiding a button is never the protection.
5. **Input validation:** all inputs validated on the server. URLs restricted to http(s).
6. **Rate limiting:** on login requests and on the API generally.
7. **Secrets:** environment variables only. Nothing sensitive in the browser or in git.
8. **Audit log:** sign-ins, status changes and every admin write.
9. **Transport:** HTTPS only, standard security headers.
10. **Data:** no real client data until the production host is ready (see section 10).
11. **Invites only:** no public sign-up. An admin must create a client user before they can sign in. The "email not found" response looks identical to "email sent" so addresses can't be probed.

## 9. Architecture

Assumption (mirrors EVIE for consistency; flag if you want to change): **React client + Node/TypeScript server + Prisma + PostgreSQL**, shipped as one Docker image so it runs unchanged on Render now and on the VPS later.

- **Email:** Resend, sending from a studio-am.co.za address (needs DNS records added at GoDaddy).
- **Config:** environment variables only (database URL, session secret, Resend key, base URL).
- **Files:** none stored in v1 (links only).
- **Observability:** structured logs, a health-check endpoint, error reporting added in v2.
- **Schema changes:** versioned Prisma migrations, applied in a controlled step.

## 10. Hosting plan

| Stage | Where | What goes there |
|---|---|---|
| **Build and demo** | Render free web service + Neon free Postgres, at portal.studio-am.co.za | Dummy clients only |
| **Production** | Your VPS: Docker Compose, Caddy (automatic HTTPS), Postgres, nightly backups | Real clients |

Notes:
- The free Render service sleeps when idle, so the first load can be slow. Acceptable for demos, not for clients.
- Move to the VPS by: restoring a database dump, setting environment variables, and changing the DNS record at GoDaddy. The code stays the same.
- If the VPS is shared with other projects, the portal gets its own containers, database and credentials.

## 11. Design direction

Not locked. To decide before the interface is built:
- Does Studio AM have a logo, colours or type already?
- If not, three directions will be proposed with the strategic reasoning behind each.

Principles regardless of direction: strong typography, generous whitespace, calm hierarchy, one accent colour, no generic dashboard clichés, fast and mobile-first (clients will often check on their phones). Accessible contrast and keyboard use.

## 12. Roadmap

**v1 (build now)**
Login, admin dashboard, client CRUD and invites, the four home blocks, Link Stack, File Folders (links), Content Calendar with approvals, Idea Bank, Moodboard (URLs), To-Do, Notice Board, audit log.

**v2 (when the first real clients are active)**
Email notifications ("posts awaiting approval"), comments threads, file upload to VPS storage, per-client branding, reporting (approval turnaround, posting consistency), onboarding checklist template.

**v3 (longer term)**
Invoice integration, e-signing, analytics pulls from social platforms, a branded client mobile app, multi-agency support.

## 13. Success measures

- A new client portal is live in under 10 minutes.
- Clients approve posts inside the portal rather than by WhatsApp or email.
- Median approval turnaround is tracked from day one.
- Zero cross-client data exposure (verified by automated tests).

## 14. Risks and open questions

| Item | Risk or question | Current assumption |
|---|---|---|
| Real client data on free hosting | Privacy and reliability | Dummy data only until the VPS is live |
| Client email addresses | Clients may use shared inboxes | One named user per login, shared inboxes discouraged |
| Link rot | Drive links break if folders are moved or permissions change | Admin checks links; v2 adds link health check |
| Pricing and packaging | Is the portal included in retainers? | To be decided with the service packages |
| Brand identity | Not yet defined | Needs a design direction before the interface is built |
| Domain email | Sending from studio-am.co.za needs DNS records | Added at GoDaddy when Resend is configured |
| Ownership | Whose GitHub, hosting and Resend accounts hold the product long-term | Currently `anjastudioam`; confirm |

## 15. Next steps

1. Review and correct this spec.
2. Choose a design direction.
3. Scaffold the project (client, server, Docker, Prisma schema).
4. Build authentication and the tenant-isolation layer first, with tests.
5. Build the client home and the sections.
6. Deploy to Render/Neon at portal.studio-am.co.za with dummy clients.
7. Production move to the VPS before any real client is invited.
