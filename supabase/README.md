# Database files

`migrations/20261120000000_legacy_trust_baseline.sql` contains schema only: the 14 legacy tables, constraints, indexes, RLS/private grants and public catalogue views. It contains no production records. Use it once to provision a fresh database.

`migrations/20261121000000_legacy_trust_data.private.sql` is a local, ignored data-only import containing all 13,151 records from the supplied dump, including personal records and historical account/token data. It requires the baseline schema and all destination tables to be empty. It locks the target tables, inserts in foreign-key dependency order, checks counts and restores identity sequences in one transaction. A repeat import is refused. Keep this file private and out of GitHub; it will be visible locally in the migrations folder but absent from Git's changes list.

Generate the private file from the original export if it is absent (the command refuses to overwrite an existing output):

```sh
cd next-app
python3 scripts/prepare-legacy-data.py /path/to/source.sql supabase/migrations/20261121000000_legacy_trust_data.private.sql
```

## Current Supabase project

The schema and all 13,151 records are already imported and verified. **Do not execute the baseline or the data import again on this project.** Neither file is an incremental change for the current database. The verified baseline and admin migrations are now registered in Supabase migration history. The baseline was marked applied after verification, without replaying its DDL.

Do not run a blanket `supabase db push` with these pending files against the populated project. Git ignore rules do not stop the Supabase CLI from finding a local SQL file. Before using the CLI, move this private bootstrap data file outside the active migrations directory. Future schema changes belong in new reviewed schema-only migration files.

On a genuinely fresh database, apply the baseline first, then this private data import once, using an administrative PostgreSQL connection with verified TLS. Do not also run the full converter import: that alternative already creates both schema and records. Legacy password/token records do not create Supabase Auth accounts.

## Admin migrations

`20261121020000_admin_workspace.sql` and `20261121030000_admin_sorting.sql` are incremental schema-only migrations applied to the current project. They provide protected staff access, administration functions, return/audit history, a private public-form inbox, and sorting/overdue filters. See [the admin guide](../../docs/admin-workspace.md).
