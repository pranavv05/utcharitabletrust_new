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

The public site supports both themes, responsive photo frames, gallery filters and a keyboard-accessible photograph viewer. Motion respects reduced-motion preferences. The official logo and existing trust photographs are used throughout.

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

Browser checks cover both themes, responsive pages, gallery controls and staff workflows. Follow-up notes do not send email or SMS; notification delivery is not configured. Business-record backups do not replace full Supabase Auth/Storage disaster recovery.
