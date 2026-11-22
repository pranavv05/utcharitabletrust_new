# Admin workspace

The administration interface is available at `/login` and `/admin`. Node.js 22 or later is recommended for the administrative scripts.

## Features and navigation

- Overview: actual copy, available, issued, overdue, donor, borrower and member counts; recent transactions; unread inbox count; activity history.
- Inventory, people, members, authors and classes: server-side search, filters, sorting and 25-record pagination; create/edit where applicable; archive instead of deleting historical records. Inventory additions use donation intake so each new copy retains its donor and receipt link. Existing UTBNs are not edited.
- Separate loans, donations and returns screens: donation intake with multiple copies, available-copy selection for issues, explicit issue/due dates, transaction details, partial/full returns, loss recording, manual penalties and printable receipts. Browser printing supports saving a PDF.
- Inbox: new contact enquiries and membership applications, review/archive actions, and full message details. Applications remain separate until staff approve them; approval creates or explicitly links the member without duplicate entry. Old contacts and feedback are separate read-only archives.
- Settings: own password change and administrator-managed staff access. Password changes require the current password. Staff email accounts must already exist in Supabase Authentication; the access form does not send invitations.
- Both light and dark modes, responsive navigation and native modal dialogs with keyboard focus handling. Public-site motion and navigation are separate from the admin layout.

## Authentication and permissions

The application uses Supabase Auth email/password sessions and an active row in `public.staff`. Imported Laravel user and token records remain private source records and do not grant access.

| Role | Rights |
| --- | --- |
| Administrator | Operational writes plus staff access management |
| Operator | Read records, create/edit/archive operational records, donations, issues and returns |
| Viewer | Read-only operational access |

`public.staff` has row-level security and grants authenticated users read access to their own row only. Browser clients cannot directly edit staff grants. All privileged RPCs check `auth.uid()` against active staff; write RPCs reject viewers; staff management requires an administrator. Administrators cannot revoke or downgrade their own administrator grant.

The private `legacy_trust` schema remains inaccessible to anonymous and ordinary authenticated API roles. `trust_admin` holds the return ledger, audit events, website submissions and reference sequences, with RLS and no direct API-role table grants. Public RPCs are the narrow access boundary; their default PUBLIC execution privileges are revoked. The app uses the public publishable key with the signed-in user's session, not a browser service-role key.

## Circulation integrity

Donation intake, issue and return operations run atomically inside PostgreSQL functions. Issues lock selected copies in a stable order and recheck availability. Partial returns preserve the original booking items and add to the return ledger instead of deleting history. Copies marked lost remain unavailable. Duplicate selections and repeat returns are refused. Historical loans that conflict over the same copy require review instead of silently changing inventory.

New UTBNs use a sequence initialised beyond the imported maximum. Donation, loan, person and membership references use prefixed sequence values. Historical identifiers, text author/class fields and donor attribution are preserved. Renaming a directory author/class does not rewrite historical book text.

Penalties are manual amounts entered by staff; no automatic overdue or replacement-cost policy is assumed. Audit entries describe operational changes. Supabase Auth maintains authentication activity separately.

Public forms write to the private submissions inbox through `submit_request`. Input validation exists in the app and database, with a five-minute per-email cooldown and a global limit of 500 submissions per day. Honeypot and same-origin checks run in the application. This is basic abuse control, not a CAPTCHA or a full spam-detection service. Submission contents remain private.

## Migrations and setup

The initial workspace used the verified legacy baseline and the following incremental migrations, recorded in `supabase_migrations.schema_migrations`:

1. `20261120000000_legacy_trust_baseline.sql` — previously imported schema, registered after verification; not replayed.
2. `20261121020000_admin_workspace.sql` — staff permissions, protected admin functions, sequences, return ledger, audit log and public-form inbox.
3. `20261121030000_admin_sorting.sql` — server-side sorting and overdue filtering, retaining the same staff checks and grants.

The workflow upgrade migrations are listed below under Website publishing and are applied after these initial versions.

The ignored `20261121000000_legacy_trust_data.private.sql` is a bootstrap data import, not an incremental migration. It is not applied again or recorded as a new import. Keep it outside the active migration directory before using the Supabase CLI's blanket migration commands. Do not reset a populated database.

For a new empty project, provision the baseline and import private records once before applying the admin migrations, so the new UTBN sequence starts beyond those records. The migrations include no administrator password or private source records.

`scripts/apply-migration.mjs` applies a named incremental SQL file with a verified TLS connection and atomically records its migration history. It refuses baseline/data imports and detects changed content for an already-applied migration. Set `PGSSLROOTCERT` to the Supabase CA certificate and keep `DATABASE_URL` server-only in ignored local environment settings.

`scripts/provision-admin.mjs` is a one-time administrative bootstrap for an existing trusted database connection. It reads the account details through hidden stdin, hashes the password in PostgreSQL, creates the email identity and approved staff row, and sends no email. It refuses an existing account rather than resetting it. Never store bootstrap input or a password in repository files. Future users can be created through Supabase Authentication and then granted a role in Settings.

## Verification

`npm test` includes a disposable PostgreSQL test for role restrictions, direct-table denial, atomic donation rollback, lookup updates/duplicates, membership creation, double-issue rejection, partial returns, loss handling, retained issue history and submission cooldown. Test Auth is mocked inside that isolated database; actual administrator sign-in is checked separately against Supabase. TypeScript checking and a production build verify the new routes and retained public pages.

Live verification uses read-only checks for the imported records and protected permissions. Do not create dummy people, loans or charges in production for QA. Broader performance benchmarking, organisation-specific lending rules and automatic membership approval are not implied by these checks.

## Workflow upgrade

The workspace now separates **Loans**, **Donations** and **Return books**. Donation type is recorded independently of the person's current role: the legacy donation controller used status `new`, while issued/returned records remain loans. The incremental classification correction changes only the new transaction index, not imported bookings. A person profile shows their contact details, outstanding-loan count and latest 200 transactions.

Donation and issue forms can create and select a missing person without leaving the operation. Donation entry supports author/category suggestions, copying an entered row and importing a UTF-8 CSV with `title,author,class_name` headers. A CSV replaces the unsaved list, is limited to 200 copies / 200 KB and must be reviewed before registration. Directory suggestions do not silently rename historical book text.

**Return books** searches outstanding loans by borrower, phone, reference or UTBN. It supports partial returns and losses using the existing ledger. Loan details also allow renewal to a later due date with a reason, and follow-up notes with contact method. Follow-up notes do not send email, SMS or WhatsApp messages.

Membership applications have an approval action. It creates a member atomically or explicitly links a matching existing email after review. Repeated approval cannot create a second member. This grants community membership only, never staff access.

**Reports** offers donations, loans, returns/losses and currently overdue loans. Ranges are limited to 366 days and results/exports to 5,000 records; narrow the range when the result is capped. Loan and donation ranges use the transaction date, while returns use ledger dates plus recorded dates on historical closed loans. Imported returns are labelled Historical return and excluded when a booking already has ledger entries, preventing duplicate reporting. Undated historical returns are counted separately and remain in transaction history. Overdue means outstanding today, not a historical end-of-period balance. Screen results paginate in groups of 50. Operators and administrators can export CSV; viewers can read the reports. CSV values are quoted and spreadsheet formula prefixes neutralised.

**Print QR labels** prints the current inventory page (up to 25 copies). Each QR encodes the numeric UTBN locally, without sending identifiers to an external QR service. A QR-capable USB/Bluetooth scanner in keyboard mode can enter the number into issue, inventory or return search. Camera-based scanning and physical printer/scanner compatibility have not been tested.

**Record review**, available only to administrators, lists the first 200 overlapping outstanding claims on a copy. Staff must verify the correct loan against their physical records, choose it and enter evidence. The other claims receive `corrected` ledger entries rather than fabricated physical returns. Their headers become `closed_correction` if nothing remains outstanding, while original issue items stay intact and the copy remains issued to the verified loan. This is an explicit operational correction; no historical conflict is resolved automatically.

## Scanning a book to fill in its details

On **Add donation**, **Scan books with the camera** opens a dialog. Staff take a photo (or choose one) of the barcode on the back cover or of the front cover:

1. The browser tries to read an ISBN barcode in the photo (the browser's own detector when available, otherwise a bundled decoder). A valid ISBN is looked up in Open Library, then Google Books. This is free and exact.
2. If there is no readable barcode, or the book is not found, the cover photo is read by a vision model through `POST /api/admin/book-scan`. This needs `GROQ_API_KEY` on the server (model from `GROQ_VISION_MODEL`). Without a key the dialog says so and staff type the details.
3. Staff always review and can edit the title, author and class before adding the book to the donation list. The dialog stays open so many books can be added in a row.

Privacy and cost: only the downscaled cover photo is sent to the provider, never donor or borrower data. Each staff member is limited to 30 scans per 10 minutes. ISBN lookups send only the ISBN to the public book databases. A typed ISBN can also be looked up directly. Barcode reading, ISBN validation and the reading service are covered by automated tests; phone camera quality varies, so a blurry photo may need to be retaken.

## Website sections managed from Website content

Administrators manage every public section from **Website content** (add, edit, search, filter, publish, archive and permanently delete):

| Tab | Public page | Notes |
| --- | --- | --- |
| News & Media | `/news`, `/news/<slug>` | Date, category, summary, story, cover and extra photographs, a YouTube/Vimeo link or an uploaded short video. Visitors can filter by year, category and search, and sort. |
| Gallery | `/gallery` | Each photograph can have a year. Select many photographs and use **Set year** to assign it in bulk. Existing photographs start undated. |
| Our work | `/our-work`, programme pages | Year filters use the years of the photographs linked to each programme. |
| Team | `/team` | Name, role, photograph and optional bio for each person; visitors can search. |
| Testimonials | home page and `/testimonials` | Quote, name, role, optional photograph and video; mark some as featured for the home page. |
| Partners | home strip and `/partners` | Logo, website, description, and a level (principal, gold, silver, supporter) that controls the order. |
| Legal documents | `/legal`, `/legal/<slug>` | Registration and tax certificates, annual reports (year-wise), policies (written text) and certifications. Upload a PDF or image. `/certificates` redirects here. |
| Intern colleges | `/interns` | Only the college, city, years and number of interns are shown, never student names. |
| ISO certification | header, hero, footer, `/legal` | Fill in the standard (for example ISO 9001:2015) and publish. Nothing is shown until it is published. |

Uploads: photographs up to 5 MB go through the server; PDFs (20 MB) and videos (MP4/WebM, 50 MB) are uploaded by the browser straight to storage with a one-time signed link created by an administrator. Uploaded files have public addresses even while attached to drafts. The migration `20261122120000_cms_sections.sql` also raises the storage bucket limit to 50 MB and allows PDF, MP4 and WebM. Permanent delete removes the content record only, not the uploaded file in storage; the activity log keeps a copy of the deleted record.

## Lending policy and receipts

The policy is set in one place, `src/lib/admin/policy.ts`: books are issued for **365 days** (the return date is set automatically and cannot be edited when issuing) and a **late fee of ₹10 per day** applies after the due date. The return form suggests the late fee for the selected books and the date chosen; staff can edit or clear it, and it is recorded only when saved. Damage and loss have no fixed amount: the receipt says the borrower pays the amount decided by the trust (current price or replacement of the same title and edition).

Receipts (`/admin/receipts/<id>`) are formal A4 documents with a letterhead, borrower details, the books, the terms and conditions in English with a Hindi translation, an acceptance line and signature boxes. Issue receipts include the terms and an ID proof line; return receipts show days late, the late fee and the penalty recorded; donation receipts are a simple acknowledgement (no tax wording); cancelled entries are marked as not valid. The trust's registration number and ISO standard are printed from **Website content → Legal documents** (give a registration document its number) and **ISO certification**; nothing is printed until they are entered there. Please have the Hindi text and the extra clauses (care of the book, personal educational use, bring the receipt, extensions) read by someone at the trust before relying on them.

## Cancelling a mistaken entry

Administrators can cancel a donation or an issued-book entry that was entered by mistake, from the entry's detail screen. A reason (10 to 500 characters) is required and the cancellation cannot be undone, but nothing is erased:

- An **issue** can be cancelled while nothing has been returned. Its copies go back on the shelf.
- A **donation** can be cancelled while all its copies are still on the shelf and have never been issued. Its copies are archived. Book numbers (UTBN) already assigned are not reused.
- The entry stays in history marked **Cancelled** (with who cancelled it and why, in the activity log). Date-range reports no longer count it. Anything that has been returned, or whose copies were issued, must be handled by archiving instead.

Migration: `20261122130000_cancel_transactions.sql`. A later migration, `20261122140000_issue_reference_prefix.sql`, makes new issue references start with `UTC-I-` (older ones keep `UTC-L-`). It also lets administrators delete the uploaded files that belonged to deleted website content (storage policies on hosted Supabase). When content is deleted from Website content, its uploaded files are removed if no other content uses them; this is best effort and never undoes the delete.

## Live updates and persistence

Successful writes are acknowledged only after Supabase confirms them. Database transactions protect multi-record operations; failed writes do not display success. Change triggers increment rows in `public.trust_changes`, whose contents are limited to scope, version and timestamp. Only those counters are added to the Realtime publication. Private borrower, membership, audit and submission rows are never replicated to public clients.

Active staff may read the admin counter. Visitors may read catalogue/content counters only. Realtime events refresh relevant lists, dashboards and public content. Focus/reconnect and 15-second visible-tab polling provide a fallback. The header says **Live updates** after a successful subscription, or **Auto refresh** when using the fallback. Data typed into an open form is retained; a save still rechecks current permissions and database state. Reports refresh their generated query after a change; unsaved filters remain local. Content edits detect stale versions and refuse to overwrite a newer edit from another session.

The activity log now also retains before/after row snapshots for operational edits. Those snapshots remain private and describe changes made after this upgrade; they cannot reconstruct edits from before logging existed.

## Website publishing

Only administrators can manage programmes, gallery items, team profiles and announcements. Existing public content is seeded into the CMS. Draft and archived records are excluded from the public `website_content` function. Published programme records drive programme cards/details; gallery and team records drive their public pages; announcements appear above page content. Public rendering reads the published database projection and refreshes after content changes. If a configured database cannot supply content, the page shows a retry state rather than resurrecting archived seed records. Static editorial copy such as About, Privacy and the president's message remains in source code.

Images can use existing `/images/` paths or the `trust-media` Supabase Storage bucket. Uploads are limited to JPEG, PNG or WebP, 5 MB each, with server-side signature checks and administrator-only insert permissions. Uploaded files have public URLs even while attached to drafts, so use public website photographs only. Archiving content does not delete its images. Automated image cleanup, private document uploads and image optimisation beyond Next.js delivery are not part of this workflow.

Incremental migrations added by this upgrade:

- `20261122000000_admin_workflows.sql`: approvals, renewals, follow-ups, profile/report/correction RPCs, transaction-type index, audit snapshots and protected Realtime counters.
- `20261122010000_website_content.sql`: staff-only CMS writes, published-only reads and a restricted public-media upload bucket.
- `20261122020000_content_seed.sql`: existing public editorial content only.
- `20261122030000_transaction_classification.sql`: correct transaction classification without modifying source records.
- `20261122040000_staff_refresh.sql`: refresh staff workspaces after access changes.
- `20261122050000_exact_copy_search.sql`: exact numeric UTBN matching for inventory and transactions, retaining reference/phone search when the number is not an existing copy.

- `20261122100000_submission_abuse_limits.sql`: per-address hourly limit for public forms.
- `20261122110000_admin_delete_restore.sql`: restore archived records and permanently delete unused ones (administrators only). Records with issue, donation, return or approval history can only be archived.

These filenames are migration versions, not an instruction to rerun the private data import. Keep applied files immutable; fixes use new incremental migrations.

## Private snapshots and recovery limits

From the repository root, `PGSSLROOTCERT=/path/to/ca.crt node scripts/backup-operations.mjs /private/path/trust.backup` creates a read-only, consistent business-record snapshot. It refuses to overwrite a file and creates mode-600 output. The snapshot contains personal data and historical tokens; keep it private and outside source control. It includes all `legacy_trust`/`trust_admin` records plus staff grants and change counters, with migration versions and per-table checksums.

`node scripts/verify-backup.mjs /private/path/trust.backup` reconstructs these business records in an isolated PGlite database, checks foreign-key dependencies, table counts and complete record equality, then discards that database. It has no remote database destination. Mock Auth UUIDs satisfy local foreign keys only and cannot restore sign-in. This verification was run successfully on a live read-only snapshot.

A business snapshot is **not a full Supabase disaster-recovery backup**. It excludes Supabase Auth accounts/sessions, Storage image files, database roles, grants outside the migration set and deployment configuration. Full recovery needs the provider's database backup plus separately preserved Storage files and environment settings. Rehearse those in a separate project before declaring full recovery tested. Scheduled backups and message delivery services still require hosting/account configuration; this change does not enable subscriptions or send messages.

## Public photo archive

The gallery includes 159 published photographs after `20261122060000_public_photo_archive.sql`: the original gallery, existing programme archives and 22 newly supplied book-bank photographs. The migration adds 147 public editorial records and leaves operational data untouched. Reapplying its inserts does not overwrite CMS edits or republish archived records.

Gallery records support a description and related website page in addition to caption, category and image. These fields appear when a visitor opens a photograph; the grid itself shows photographs only. Visitors can filter by subject and sort by title or subject. Photograph dates are not inferred from filenames. Manage visibility and display order through Website content → Gallery.

## Contact topics and website assistant

`20261122070000_contact_topics.sql` restricts new contact enquiries to Donate essentials, Volunteer, Request support, Partner with us, or Media & other. Contact phone numbers may be omitted; membership applications still require a valid phone number and city. Existing submissions and database access grants are preserved.

The public assistant answers from the published CMS content. Its built-in guide works without an external key. Add `GROQ_API_KEY` to the ignored `.env.local` (or server deployment settings) and restart the server to enable Groq replies. The default model is `openai/gpt-oss-20b`; `GROQ_MODEL` can override it. Never prefix the key with `NEXT_PUBLIC_`. No private staff, donor, borrower or library data is sent to the provider. The assistant cannot perform administrative actions or send messages.

Chat transcripts are held in page memory and are not written to Supabase. When Groq is enabled, the last few chat messages and public trust context are sent to Groq. Provider errors use the website guide as a fallback. Requests have bounded history/output and a per-process burst limit; this is not a distributed quota. Configure Groq project spend/rate limits before public deployment and use a shared rate limiter if deploying across multiple instances.

## Admin audit — 22 November 2026

The audit verified authenticated read APIs for all administration sections, dashboard data, exact UTBN lookup, person/transaction details, both loan and donation receipts, QR label generation, reports and CSV exports. Anonymous reads, cross-origin writes and malformed write bodies were rejected. Browser checks covered sign-in, responsive navigation, exact inventory search, donation-row controls and issue-form scanner input without saving dummy production transactions.

Fixes include India-time calendar rules (`20261122080000_admin_business_timezone.sql`), historical returns in reports (`20261122090000_historical_return_reports.sql`), a safe renewal date when a historical due date is missing, record-page clamping after totals shrink, validation of malformed authentication bodies, recovery from transient load errors, and rejecting overlong CSV values instead of silently truncating them. Returned-loan receipts now have an explicit Book return heading.

The isolated database suite tests atomic donation/issue/return/loss flows, duplicate prevention, renewals, approvals, staff roles and disabled access, CMS draft/publish/archive visibility, stale CMS edits, historical report deduplication, private-table denial and change-counter permissions. Date-boundary, malformed-auth, pagination and donation-CSV tests add regression coverage. TypeScript and the production build pass.

Production business records were not edited for QA. The two audit migrations change function settings/report queries only. Password changes, staff-access edits and live media uploads were reviewed and covered by existing validation/permissions rather than performed on production. Physical printers/scanners, sustained concurrent load, full Auth/Storage disaster recovery and external message delivery were not exercised. Passing these checks is not a guarantee of defect-free behaviour under every condition.
