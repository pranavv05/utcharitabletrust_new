// Applies every migration in supabase/migrations that is not yet recorded in the database, in order.
//
//   node scripts/apply-pending-migrations.mjs --dry-run   (only lists what would be applied)
//   node scripts/apply-pending-migrations.mjs             (applies them, one transaction per file)
//
// Needs DATABASE_URL and PGSSLROOTCERT (the Supabase CA file) in .env.local or the environment.
// Each file runs in its own transaction and is recorded in supabase_migrations.schema_migrations.
// It stops at the first failure, so a failed file changes nothing and later files are not run.
// It never touches the baseline or private data imports, and refuses a database that has not had the
// admin workspace migration yet (use scripts/apply-admin-migration.mjs for that first step).
import fs from 'node:fs';
import path from 'node:path';
import {Client} from 'pg';

const dir = 'supabase/migrations';
const pattern = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/** Versions in `files` (names like 20261122130000_name.sql) that are not in `applied`, oldest first. */
export function pendingMigrations(files, applied) {
  const done = new Set(applied);
  return files
    .filter((f) => pattern.test(f) && !f.includes('baseline') && !f.includes('.private.'))
    .sort()
    .filter((f) => !done.has(f.match(pattern)[1]));
}

async function main() {
  if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is not set.');
  if (!process.env.PGSSLROOTCERT) throw Error('Set PGSSLROOTCERT to the Supabase CA certificate file.');
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {ca: fs.readFileSync(process.env.PGSSLROOTCERT), rejectUnauthorized: true},
    connectionTimeoutMillis: 15000,
  });
  await db.connect();
  try {
    const hasStaff = (await db.query("SELECT to_regclass('public.staff') IS NOT NULL AS ok")).rows[0].ok;
    if (!hasStaff)
      throw Error(
        'The admin workspace migration has not been applied. Run scripts/apply-admin-migration.mjs first.',
      );
    const applied = (await db.query('SELECT version FROM supabase_migrations.schema_migrations')).rows.map(
      (r) => r.version,
    );
    const pending = pendingMigrations(fs.readdirSync(dir), applied);
    if (!pending.length) {
      console.log('Nothing to apply: the database is up to date.');
      return;
    }
    console.log((dryRun ? 'Would apply' : 'Applying') + ` ${pending.length} migration(s):`);
    pending.forEach((f) => console.log('  ' + f));
    if (dryRun) return;
    for (const file of pending) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const [, version, name] = file.match(pattern);
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(82103422)');
        await db.query(sql.replace(/^BEGIN;\s*$/m, '').replace(/COMMIT;\s*$/, ''));
        await db.query(
          'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
          [version, name, [sql]],
        );
        await db.query('COMMIT');
        console.log('Applied ' + file);
      } catch (e) {
        await db.query('ROLLBACK').catch(() => {});
        console.error(`Failed on ${file}: ${e.code || ''} ${e.message}`);
        console.error('Nothing from this file was applied, and later files were not run.');
        process.exitCode = 1;
        return;
      }
    }
    console.log('All pending migrations applied.');
  } finally {
    await db.end();
  }
}

if (process.argv[1]?.endsWith('apply-pending-migrations.mjs'))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
