// Administrative, one-time bootstrap. JSON input comes from stdin, never arguments.
// No email is sent. Refuses to overwrite an existing authentication account.
import fs from 'node:fs';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
process.loadEnvFile('.env.local');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for administrative setup JSON on stdin (input is hidden).');
const reader = createInterface({input: process.stdin, terminal: false});
const [line] = await once(reader, 'line');
reader.close();
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const input = JSON.parse(line);
if (
  typeof input.email !== 'string' ||
  !input.email.includes('@') ||
  typeof input.password !== 'string' ||
  input.password.length < 8
)
  throw Error('An email and password of at least eight characters are required.');
const ca = process.env.PGSSLROOTCERT;
if (!ca) throw Error('Set PGSSLROOTCERT to the Supabase CA file.');
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {ca: fs.readFileSync(ca), rejectUnauthorized: true},
  connectionTimeoutMillis: 15000,
});
try {
  await db.connect();
  await db.query('BEGIN');
  const email = input.email.trim().toLowerCase();
  if ((await db.query('SELECT id FROM auth.users WHERE lower(email)=$1', [email])).rowCount)
    throw Error('Account already exists; bootstrap will not overwrite it.');
  const id = randomUUID();
  await db.query(
    `INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token)
 VALUES('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf',12)),now(),'{"provider":"email","providers":["email"]}',$4,false,now(),now(),'','','','','','')`,
    [id, email, input.password, JSON.stringify({name: input.name || 'Trust Administrator'})],
  );
  await db.query(
    `INSERT INTO auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) VALUES($1::text,$1::uuid,$2,'email',now(),now())`,
    [id, JSON.stringify({sub: id, email, email_verified: true})],
  );
  await db.query("INSERT INTO public.staff(user_id,name,role) VALUES($1,$2,'admin')", [
    id,
    input.name || 'Trust Administrator',
  ]);
  await db.query('COMMIT');
  console.log('Administrator created. No email was sent.');
} catch (e) {
  await db.query('ROLLBACK').catch(() => {});
  console.error('Bootstrap failed:', e.code || e.message);
  process.exitCode = 1;
} finally {
  input.password = '';
  await db.end();
}
