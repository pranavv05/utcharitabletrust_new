// Finds files in the trust-media storage bucket that no website content uses (for example the videos and
// preview pictures left behind by uploads whose record could not be saved), and optionally deletes them.
//
//   node scripts/clean-orphan-media.mjs            (only lists the unused files and their total size)
//   node scripts/clean-orphan-media.mjs --delete   (deletes exactly the files that were listed)
//
// Listing needs DATABASE_URL and PGSSLROOTCERT (as for the migration scripts) in .env.local.
// Deleting also needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project settings → API keys),
// because files must be removed through the Storage API. Nothing is deleted without --delete, files
// younger than 10 minutes are never touched, and a file is kept if any content record still points to it.
import fs from 'node:fs';
import {Client} from 'pg';

const BUCKET = 'trust-media';

/** Objects (name, size, created) that no record references and that are old enough to be safe to remove. */
export function findOrphans(objects, referenced, {now = Date.now(), minAgeMs = 10 * 60 * 1000} = {}) {
  const used = new Set(referenced);
  return objects.filter(
    (o) =>
      o.name &&
      !o.name.endsWith('.emptyFolderPlaceholder') &&
      !used.has(o.name) &&
      now - new Date(o.created).getTime() >= minAgeMs,
  );
}

const megabytes = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

async function main() {
  if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
  const doDelete = process.argv.includes('--delete');
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL is not set.');
  if (!process.env.PGSSLROOTCERT) throw Error('Set PGSSLROOTCERT to the Supabase CA certificate file.');
  if (doDelete && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY))
    throw Error('Deleting needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {ca: fs.readFileSync(process.env.PGSSLROOTCERT), rejectUnauthorized: true},
    connectionTimeoutMillis: 15000,
  });
  await db.connect();
  let orphans;
  try {
    const objects = (
      await db.query(
        `SELECT name, coalesce((metadata->>'size')::bigint,0)::float8 AS size, created_at AS created
           FROM storage.objects WHERE bucket_id=$1`,
        [BUCKET],
      )
    ).rows;
    const referenced = (
      await db.query(
        `SELECT DISTINCT m[1] AS path FROM trust_admin.site_content,
           regexp_matches(data::text, 'trust-media/([A-Za-z0-9_./-]+)', 'g') AS m`,
      )
    ).rows.map((r) => r.path);
    console.log(`${objects.length} file(s) in storage, ${referenced.length} used by website content.`);
    orphans = findOrphans(objects, referenced);
    if (doDelete && objects.length && !referenced.length)
      throw Error('No website content points to any file, which looks wrong. Nothing was deleted.');
  } finally {
    await db.end();
  }
  const total = orphans.reduce((sum, o) => sum + o.size, 0);
  console.log(`${orphans.length} unused file(s), ${megabytes(total)}:`);
  orphans.slice(0, 200).forEach((o) => console.log(`  ${o.name}  ${megabytes(o.size)}`));
  if (orphans.length > 200) console.log(`  … and ${orphans.length - 200} more`);
  if (!orphans.length || !doDelete) {
    if (orphans.length) console.log('Nothing deleted. Run again with --delete to remove these files.');
    return;
  }
  const {createClient} = await import('@supabase/supabase-js');
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false},
  }).storage.from(BUCKET);
  let removed = 0;
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100).map((o) => o.name);
    const {error} = await storage.remove(batch);
    if (error) throw Error(`Stopped after deleting ${removed} file(s): ${error.message}`);
    removed += batch.length;
    console.log(`Deleted ${removed} of ${orphans.length}`);
  }
  console.log(`Done. Freed about ${megabytes(total)}.`);
}

if (process.argv[1]?.endsWith('clean-orphan-media.mjs'))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
