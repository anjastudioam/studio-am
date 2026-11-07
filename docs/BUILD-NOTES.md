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
