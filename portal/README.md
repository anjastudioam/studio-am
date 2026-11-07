# Studio AM Client Portal

Private, branded workspace for each Studio AM client: link stack, file folders, to-do, notice board, content calendar with approvals, idea bank and moodboard. See `../docs/PRODUCT-SPEC.md` for the full spec.

**Status:** backend complete and tested (auth, tenant isolation, all section APIs). Client interface is the next build step.

## Stack
Node 22 + TypeScript, Express 4, PostgreSQL, Drizzle ORM (SQL migrations), Zod validation, Resend for email. Ships as one Docker image.

> Change from the spec: Drizzle replaces Prisma. Prisma needs engine binaries that could not be downloaded in the build environment, and Drizzle is lighter and fully testable. The database is plain Postgres either way.

## Run it locally
```
npm install
cp .env.example .env        # then edit DATABASE_URL and ADMIN_EMAIL
npm run dev                 # starts on http://localhost:3000, applies migrations, creates the admin
```
With no `RESEND_API_KEY`, sign-in links are printed in the terminal instead of emailed.

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
