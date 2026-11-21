// Explicit incremental schema migration runner; private imports are never applied.
import fs from 'node:fs';
import path from 'node:path';
import {Client} from 'pg';
process.loadEnvFile('.env.local');
const file=process.argv[2];
if(!file||!/^\d{14}_[a-z_]+\.sql$/.test(file)||file.includes('baseline')||file.includes('data'))throw Error('Provide an incremental schema migration filename, not a bootstrap import.');
const sql=fs.readFileSync(path.join('supabase/migrations',file),'utf8');const [version]=file.split('_');const name=file.slice(15,-4);
const db=new Client({connectionString:process.env.DATABASE_URL,ssl:{ca:fs.readFileSync(process.env.PGSSLROOTCERT),rejectUnauthorized:true},connectionTimeoutMillis:15000});
try{await db.connect();await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(82103422)');
 const {rows}=await db.query('SELECT statements FROM supabase_migrations.schema_migrations WHERE version=$1',[version]);
 if(rows.length){if(rows[0].statements?.[0]!==sql)throw Error('Applied migration differs from this file');console.log('Migration already applied; no changes.');await db.query('ROLLBACK')}
 else{const body=sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');await db.query(body);await db.query('INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3)',[version,name,[sql]]);await db.query('COMMIT');console.log('Applied incremental migration:',file)}
}catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('Migration failed:',e.code||'',e.message);process.exitCode=1}finally{await db.end()}
