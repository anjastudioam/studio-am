# Portal build notes

## 7 Nov 2026: backend v0.1 complete
Location: `portal/` (inside the studio-am repo). 43 automated tests pass.

### Decisions that differ from PRODUCT-SPEC.md
| Spec said | Built | Why |
|---|---|---|
| Prisma | Drizzle ORM | Prisma engine binaries could not be downloaded in the build environment; Drizzle is lighter and testable. Database is still plain Postgres. |
| ClientUser join table | `users.client_id` column | One client per user in v1; simpler, same protection. Easy to change later. |
| Agency table | Not built | Only one agency; add when a second agency exists. |
| http(s) links | https only | Safer; no real downside. |
| Clients see all posts | Clients never see DRAFT posts or internal notes | Drafts are the agency's working space. |

### Not built yet
Client interface (login screen, admin dashboard, client home and sections), email domain setup, deployment.

### Next steps
1. Build the client interface using DESIGN-TOKENS.md.
2. Deploy demo to Render + Neon with dummy clients.
3. Set up studio-am.co.za email sending (Resend DNS records at GoDaddy).
4. Production move to the VPS before inviting real clients.

## 7 Nov 2026: interface v0.1 built (client-facing version)
Location: `portal/client/` (React + Vite), served by the same server as the API. 43 server tests pass; an automated click-through of the interface also passed (to-dos, approvals, admin actions, client blocked from other clients). Mobile layout checked at 390px wide.

### Direction change (same day)
The portal is now an INTERNAL tool for Studio AM only. Clients will not sign in. Needed: switch between clients, edit everything per client, and ONE master content calendar showing all clients together.
What this means for the build:
- Keep the per-client data model (every record belongs to a client).
- Add a master calendar across all clients (colour-coded, filter by client) and a quick client switcher.
- Client sign-in, approvals and client-side permissions stay in the code, switched off in the interface. Not deleted, because they're tested and may be wanted later.

### Known limits
- The logo is a small raster image and looks soft when enlarged. A vector (SVG) version is needed.
- Moodboard uses image links, not uploads.
- Email sign-in needs the Resend account and DNS records for studio-am.co.za.
- Docker image not yet built or run (no Docker in the build environment).

### Next steps
1. Demo deployment on Render + Neon (dummy data only).
3. Move to the VPS before real client information goes in.

## 7 Nov 2026: reworked for internal use (done)
One shared account. Added: master content calendar across all clients (colour-coded, filter by client and status, add and edit posts for any client), client switcher in the side bar, rename client. Removed from the interface: client invites and the "viewing as" banner. Client sign-in and approvals remain in the code, switched off.
44 server tests pass; automated browser checks passed for the master calendar, filters, adding and editing posts, switcher and phone layout.

### Next steps
1. Demo deployment on Render + Neon (dummy data only).
2. Move to the VPS before real client information goes in.
3. Vector (SVG) version of the logo.
