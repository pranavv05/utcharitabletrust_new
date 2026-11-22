# UT Charitable Trust

The current Next.js public website and Supabase-backed administration panel. This repository contains the Next.js application at its root; the retired PHP application is excluded.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local
# Fill in your Supabase URL and publishable key in .env.local.
npm run dev
```

Website: http://localhost:3000. Administration: http://localhost:3000/admin (sign in at `/login`). For a production preview, run `npm run build` then `npm start`.

## Structure

- `src/app/(site)/`: public pages, programme details, gallery, book bank and forms.
- `src/app/(console)/`: staff login and protected administration routes.
- `src/app/api/`: validated request, catalogue, authentication and administration endpoints.
- `src/components/`: public sections, reusable controls and admin workflows.
- `src/lib/`: Supabase clients, authentication, validation and content access.
- `src/styles/`: visual design, light/dark themes, responsive layouts and motion.
- `public/`: official logo and optimized trust photographs.
- `supabase/migrations/`: reviewed PostgreSQL schema, access controls, RPCs and public editorial content seeds.
- `scripts/`: migration, private legacy conversion, account setup and backup utilities.
- `tests/`: database permissions/workflows, validation and CSV tests.

Next.js 15 App Router, React, TypeScript, Tailwind CSS 4, Supabase, GSAP, Lenis and Framer Motion. Fonts are locally hosted with licenses in `src/styles/fonts/`.

## Website and administration

The public site uses a light theme with a rotating full-width photo hero, consistent image/text layouts, a programme slider, responsive photo frames, gallery subject filters and sorting, and a keyboard-accessible photograph viewer. Motion respects reduced-motion preferences. The official logo and existing trust photographs are used throughout.

Published programmes, gallery entries, team profiles and announcements come from Supabase. The book bank reads a limited public catalogue. Contact and membership forms persist through protected database functions.

The administration panel manages inventory, donors, borrowers, memberships, donations, loans, returns, receipts, enquiries, reports and website publishing. Active staff roles control access. Mutations run through authenticated PostgreSQL RPCs; private operational tables are not directly exposed to the public API. Live change counters trigger refreshes, with polling/focus fallback.

See [the admin guide](docs/admin-workspace.md) for roles, workflows, publishing, migration procedures and recovery limitations.

## Supabase and deployment

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the deployment environment before building. Browser-visible variables contain only public project settings. `DATABASE_URL` is used by administrative scripts and must remain server-only. Runtime staff operations use the signed-in Supabase session, not a service-role key.

Deploy from the repository root. Configure the correct site URL and redirect URLs in Supabase Authentication for your deployment.

The baseline migration creates empty legacy tables and public catalogue views. **It does not include the private legacy records.** Those records are already imported in the existing configured database. Do not replay the baseline or a data import over that database. Apply only unapplied incremental migrations after reviewing their history. Fresh projects require a separately reviewed private data import and Supabase Auth/staff setup.

Credentials, account passwords, personal SQL dumps, private data migrations, backups, dependencies and build output are excluded from Git. Website editorial content seeds contain only existing public content. Never commit `.env.local` or generated private import files.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Browser checks cover the public light theme, admin themes, responsive pages, gallery controls and staff workflows. Follow-up notes do not send email or SMS; notification delivery is not configured. Business-record backups do not replace full Supabase Auth/Storage disaster recovery.

## Form and login abuse protection

- Contact and membership forms are limited to 6 requests per 10 minutes per visitor address in the app, and 5 submissions per hour per hashed address in the database (`20261122100000_submission_abuse_limits.sql`, apply it after review).
- Optional Cloudflare Turnstile: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Without the secret, the check is skipped.
- Staff sign-in and password-change attempts are throttled per account and address. All in-app limiters are per server instance; keep Supabase Auth rate limits and edge/WAF limits enabled too.
- `submit_request` is callable with the public Supabase key, so a caller that skips the website can omit the address hash. The global 500/day cap still applies; closing this fully needs a server-held secret or an Edge Function in front of the RPC.

## Website assistant

The floating assistant uses the trust’s published content. A local guide works without an AI key. To enable Groq-backed replies, set `GROQ_API_KEY` in `.env.local` or the server deployment environment and restart the server. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. Never put the secret in a `NEXT_PUBLIC_` variable or commit it.

Chat messages are held in page memory, not stored in Supabase. Groq receives the recent chat and public trust context only when configured. The assistant cannot access private operations or perform actions. Set provider spending limits before public deployment; the built-in per-process burst protection is not a shared multi-instance quota.
