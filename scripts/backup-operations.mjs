// Read-only business-record snapshot. Does not contain Auth accounts or Storage files.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
const output=process.argv[2];
if(!output||!output.endsWith('.backup'))throw Error('Provide a new private output path ending in .backup. Keep it outside the repository.');
process.loadEnvFile('.env.local');
if(!process.env.PGSSLROOTCERT)throw Error('PGSSLROOTCERT is required.');
const db=new Client({connectionString:process.env.DATABASE_URL,ssl:{ca:fs.readFileSync(process.env.PGSSLROOTCERT),rejectUnauthorized:true},connectionTimeoutMillis:15000});
let handle;
try{await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const tables=(await db.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('legacy_trust','trust_admin') OR (schemaname='public' AND tablename IN ('staff','trust_changes')) ORDER BY schemaname,tablename")).rows;
const snapshot={format:'uttrust-business-snapshot-v1',created_at:new Date().toISOString(),excludes:['Supabase Auth accounts and sessions','Storage image files','database schema and grants'],migrations:(await db.query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version')).rows.map(r=>r.version),tables:[]};
for(const t of tables){const ident='"'+t.schemaname.replaceAll('"','""')+'"."'+t.tablename.replaceAll('"','""')+'"';const {rows:[data]}=await db.query(`SELECT coalesce(jsonb_agg(x ORDER BY x::text),'[]'::jsonb) AS records FROM (SELECT to_jsonb(t) AS x FROM ${ident} t)d`);const json=JSON.stringify(data.records);snapshot.tables.push({schema:t.schemaname,table:t.tablename,count:data.records.length,sha256:createHash('sha256').update(json).digest('hex'),records:data.records})}
await db.query('COMMIT');handle=fs.openSync(output,'wx',0o600);fs.writeFileSync(handle,JSON.stringify(snapshot));console.log('Private business snapshot saved. Tables:',snapshot.tables.length,'Records:',snapshot.tables.reduce((n,t)=>n+t.count,0));
}catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('Backup failed:',e.code||e.message);process.exitCode=1}finally{if(handle!==undefined)fs.closeSync(handle);await db.end()}
