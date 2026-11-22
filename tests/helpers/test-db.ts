import {readdirSync, readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const dir = new URL('../../supabase/migrations/', import.meta.url);

/** A throwaway Postgres with the Supabase auth shim and every committed migration applied in order. */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;`,
  );
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.includes('.private.'))
    .sort()) {
    await db.exec(readFileSync(new URL(name, dir), 'utf8'));
  }
  await db.exec("SET TIME ZONE 'UTC'");
  const rpc = async (name: string, args: unknown[] = []) => {
    const r = await db.query<Record<string, unknown>>(
      `SELECT public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS value`,
      args,
    );
    return r.rows[0].value;
  };
  const staff = {
    admin: '00000000-0000-4000-8000-0000000000a1',
    operator: '00000000-0000-4000-8000-0000000000a2',
    viewer: '00000000-0000-4000-8000-0000000000a3',
  };
  for (const [role, id] of Object.entries(staff)) {
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [id, role + '@example.test']);
    await db.query('INSERT INTO public.staff(user_id,name,role) VALUES($1,$2,$3)', [
      id,
      'Test ' + role,
      role,
    ]);
  }
  const as = (role: keyof typeof staff) =>
    db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [staff[role]]);
  return {db, rpc, as};
}
