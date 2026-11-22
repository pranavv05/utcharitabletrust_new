// Applies only the reviewed incremental admin migration; never imports data.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
process.loadEnvFile('.env.local');
const version = '20261121020000';
const name = 'admin_workspace';
const sql = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8');
const baseline = fs.readFileSync('supabase/migrations/20261120000000_legacy_trust_baseline.sql', 'utf8');
if (!process.env.PGSSLROOTCERT) throw Error('Set PGSSLROOTCERT to the Supabase CA certificate.');
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {ca: fs.readFileSync(process.env.PGSSLROOTCERT), rejectUnauthorized: true},
  connectionTimeoutMillis: 15000,
});
try {
  await db.connect();
  const exists = (await db.query("SELECT to_regclass('public.staff') IS NOT NULL AS exists")).rows[0].exists;
  if (exists)
    throw Error('Admin schema already exists. Inspect migration history; do not replay this migration.');
  const count = (
    await db.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='legacy_trust' AND table_type='BASE TABLE'",
    )
  ).rows[0].count;
  if (count !== 14) throw Error('Expected verified 14-table legacy baseline. Refusing migration.');
  const before = (await db.query('SELECT count(*)::int AS count FROM legacy_trust.book_lists')).rows[0].count;
  const withoutCommit = sql.replace(/COMMIT;\s*$/, '');
  if (withoutCommit === sql) throw Error('Migration must end with COMMIT.');
  await db.query(withoutCommit);
  await db.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
  await db.query(
    'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text)',
  );
  await db.query(
    'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3) ON CONFLICT(version) DO NOTHING',
    ['20261120000000', 'legacy_trust_baseline', [baseline]],
  );
  await db.query(
    'INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',
    [version, name, [sql]],
  );
  const after = (await db.query('SELECT count(*)::int AS count FROM legacy_trust.book_lists')).rows[0].count;
  if (after !== before) throw Error('Book count changed; migration cancelled.');
  await db.query('COMMIT');
  console.log('Admin migration applied; baseline and admin migration registered.');
  console.log('Imported book copies preserved:', after);
  console.log('Migration SHA-256:', createHash('sha256').update(sql).digest('hex'));
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('Migration failed:', e.code || '', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
