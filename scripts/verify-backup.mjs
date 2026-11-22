// Disposable local business-data reconstruction; never connects to Supabase.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const snapshot=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(snapshot.format!=='uttrust-business-snapshot-v1')throw Error('Unknown snapshot format');
const quote=x=>'"'+x.replaceAll('"','""')+'"';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const sorted=rows=>rows.map(r=>JSON.stringify(canonical(r))).sort();
const db=new PGlite();
try{
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;SET TIME ZONE 'UTC';`);
const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.includes('.private.')&&snapshot.migrations.includes(f.slice(0,14))).sort();
if(files.length!==snapshot.migrations.length)throw Error('Matching schema migration files are required');
for(const file of files)await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
const tables=snapshot.tables;
for(const t of tables){if(!['legacy_trust','trust_admin','public'].includes(t.schema)||!/^[a-z_]+$/.test(t.table))throw Error('Invalid table');if(t.count!==t.records.length||createHash('sha256').update(JSON.stringify(t.records)).digest('hex')!==t.sha256)throw Error('Snapshot checksum mismatch: '+t.table)}
const actualTables=(await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('legacy_trust','trust_admin') OR (schemaname='public' AND tablename IN ('staff','trust_changes'))")).rows;
if(actualTables.length!==tables.length||actualTables.some(a=>!tables.some(t=>t.schema===a.schemaname&&t.table===a.tablename)))throw Error('Snapshot table set differs from the reconstructed schema');
// Auth UUID stubs satisfy foreign keys only. They cannot restore sign-in.
for(const s of tables.find(t=>t.schema==='public'&&t.table==='staff').records)await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[s.user_id,'restore-'+s.user_id+'@example.test']);
const names=tables.map(t=>quote(t.schema)+'.'+quote(t.table));
await db.exec('TRUNCATE '+names.join(','));
for(const name of names)await db.exec('ALTER TABLE '+name+' DISABLE TRIGGER USER');
const edges=(await db.query("SELECT n.nspname AS schema,c.relname AS table,rn.nspname AS parent_schema,r.relname AS parent_table FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class r ON r.oid=f.confrelid JOIN pg_namespace rn ON rn.oid=r.relnamespace WHERE f.contype='f'")).rows;
const pending=[...tables],done=new Set();let count=0;
while(pending.length){const index=pending.findIndex(t=>edges.filter(e=>e.schema===t.schema&&e.table===t.table).every(e=>!tables.some(p=>p.schema===e.parent_schema&&p.table===e.parent_table)||done.has(e.parent_schema+'.'+e.parent_table)));if(index<0)throw Error('Unresolved foreign-key dependency');const [t]=pending.splice(index,1);const name=quote(t.schema)+'.'+quote(t.table);await db.query('INSERT INTO '+name+' OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::'+name+',$1::jsonb)',[JSON.stringify(t.records)]);const actual=(await db.query('SELECT to_jsonb(t) AS record FROM '+name+' t')).rows.map(r=>r.record);if(JSON.stringify(sorted(actual))!==JSON.stringify(sorted(t.records)))throw Error('Restored records differ: '+name);done.add(t.schema+'.'+t.table);count+=actual.length}
console.log('Verified isolated reconstruction:',tables.length,'tables,',count,'business records. Auth accounts and Storage files are excluded.');
}finally{await db.close()}
