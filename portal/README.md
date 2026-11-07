# Studio AM Client Portal

Internal tool for Studio AM (clients do not sign in). One shared account, a page per client, and one master calendar across all clients. Per client: link stack, file folders, to-do, notice board, content calendar with approvals, idea bank and moodboard. See `../docs/PRODUCT-SPEC.md` for the full spec.

**Status:** backend and interface built and tested. Next: demo deployment (Render + Neon, dummy data only), then the VPS for real clients.

## Stack
Node 22 + TypeScript, Express 4, PostgreSQL, Drizzle ORM (SQL migrations), Zod validation, Resend for email. Ships as one Docker image.

> Change from the spec: Drizzle replaces Prisma. Prisma needs engine binaries that could not be downloaded in the build environment, and Drizzle is lighter and fully testable. The database is plain Postgres either way.

## Run it locally
```
npm install
cp .env.example .env        # then edit DATABASE_URL and ADMIN_EMAIL
npm run dev                 # starts on http://localhost:3000, applies migrations, creates the admin
```
Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters; applied only while the account has no password). Add teammates and reset passwords under Settings. This is an internal tool: client accounts cannot sign in.

## Sample data
Load or remove fictional clients from Settings, Sample data. They are flagged `is_demo` and removed with everything they own.

## Install as an app
The portal is a PWA. Over HTTPS, use Install in Chrome/Edge, Add to Home screen on Android, or Share, Add to Home Screen on iOS.

```
npm run build && npm start  # serves the portal and the interface on one port
```

For interface work run `npm run dev` and `npm run dev:client` together; the client dev server proxies /api to port 3000.

## Tests
```
createdb portal_test        # once
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/portal_test npm test
```
The suite signs in through the real magic-link flow and checks, among other things, that one client can never read or change another client's data, that clients cannot see drafts or internal notes, and that links are single-use.

## How data separation works
All client-owned data is read and written through `server/src/scope/clientScope.ts`. A scope is created for one client and every query it runs is constrained to that client's id. Routes never query client tables directly. New client-owned tables must be registered there and carry a `client_id`.

## Environment variables
See `.env.example`. In production `BASE_URL` must be https and `RESEND_API_KEY` must be set; the app refuses to start otherwise.

## Database changes
Edit `server/src/db/schema.ts`, run `npm run db:generate`, commit the new file in `server/drizzle/`. Migrations are applied automatically at startup.

## Deploy
- **Now (demo, dummy data only):** Render web service from the Dockerfile + Neon Postgres, custom domain `portal.studio-am.co.za`.
- **Production (real client data):** the VPS, Docker Compose + Caddy for HTTPS + nightly database backups.
