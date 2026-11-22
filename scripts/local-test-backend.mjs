// A local stand-in for Supabase, for testing the whole app without touching any real project.
//
//   node scripts/local-test-backend.mjs            (listens on http://localhost:54321)
//
// It runs every committed migration in a throwaway in-memory Postgres (PGlite) and speaks the small part of
// the Supabase API the app uses: Auth (password sign-in), REST (rpc + table reads, with row-level security
// applied as the signed-in role) and Storage (uploads, signed uploads, public files). Realtime is not
// provided; the app then falls back to polling, exactly as it does if realtime is unavailable.
//
// FOR LOCAL TESTING ONLY. Test accounts and the password below exist only in this process.
// It is not a security boundary and is never used in production.
import {createServer} from 'node:http';
import {createHmac, randomUUID} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const PORT = Number(process.env.PORT || 54321);
const BASE = process.env.PUBLIC_BASE || `http://localhost:${PORT}`;
const SECRET = 'local-test-secret';
export const TEST_PASSWORD = 'LocalTest-Password-1';
const accounts = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    email: 'admin@example.test',
    name: 'Test Administrator',
    role: 'admin',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    email: 'operator@example.test',
    name: 'Test Operator',
    role: 'operator',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a3',
    email: 'viewer@example.test',
    name: 'Test Viewer',
    role: 'viewer',
  },
];
const passwords = new Map(accounts.map((a) => [a.email, TEST_PASSWORD]));

// ---------- database ----------
const db = new PGlite();
const dir = new URL('../supabase/migrations/', import.meta.url);
await db.exec(
  `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;`,
);
for (const name of readdirSync(dir)
  .filter((f) => f.endsWith('.sql') && !f.includes('.private.'))
  .sort())
  await db.exec(readFileSync(new URL(name, dir), 'utf8'));
// The real project stores files under https://<project>.supabase.co; here they live on this server.
await db.exec(`CREATE OR REPLACE FUNCTION trust_admin.valid_media(url text,kinds text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT url='' OR (kinds LIKE '%image%' AND (url ~ '^/images/[a-zA-Z0-9_./-]+\\.(png|jpg|jpeg|webp)$' OR url ~ '/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\\.(png|jpg|jpeg|webp)$'))
  OR (kinds LIKE '%pdf%' AND url ~ '/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\\.pdf$')
  OR (kinds LIKE '%video%' AND url ~ '/storage/v1/object/public/trust-media/[a-zA-Z0-9_./-]+\\.(mp4|webm)$') $$;`);
for (const a of accounts) {
  await db.query('INSERT INTO auth.users VALUES($1,$2)', [a.id, a.email]);
  await db.query('INSERT INTO public.staff(user_id,name,role) VALUES($1,$2,$3)', [a.id, a.name, a.role]);
}
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));
const grantsPublic = ['anon', 'authenticated'];

async function inRole(role, sub, fn) {
  return serial(() =>
    db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [sub || '']);
      return fn(tx);
    }),
  );
}

// ---------- helpers ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload) {
  const head = b64({alg: 'HS256', typ: 'JWT'});
  const body = b64(payload);
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
function verify(token) {
  const [h, b, s] = String(token || '').split('.');
  if (!s || createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url') !== s) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}
const refreshTokens = new Map();
function session(account) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: account.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: account.email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: {provider: 'email'},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const refresh = randomUUID();
  refreshTokens.set(refresh, account.id);
  return {
    access_token: sign({
      sub: account.id,
      email: account.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp,
    }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: refresh,
    user,
  };
}
const quote = (name) => '"' + String(name).replace(/"/g, '""') + '"';
const identifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function send(res, status, body, headers = {}) {
  const isBuffer = Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isBuffer ? headers['Content-Type'] || 'application/octet-stream' : 'application/json',
    ...headers,
  });
  res.end(status === 204 ? undefined : isBuffer ? body : JSON.stringify(body));
}
const pgError = (e) => {
  const code = e.code || 'XX000';
  const status = code === '42501' ? 403 : code === '23505' ? 409 : code === '42883' ? 404 : 400;
  return [status, {code, message: e.message, details: e.detail || null, hint: e.hint || null}];
};
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// ---------- REST: rpc ----------
const arrayLiteral = (list) =>
  '{' + list.map((x) => '"' + String(x).replace(/(["\\])/g, '\\$1') + '"').join(',') + '}';
async function rpc(fn, args, role, sub) {
  if (!identifier.test(fn)) return [404, {code: 'PGRST202', message: 'Not found'}];
  const found = (
    await serial(() =>
      db.query(
        `SELECT p.pronargs,p.pronargdefaults,p.proargnames,p.prorettype::regtype::text AS ret,
          ARRAY(SELECT format_type(t,NULL) FROM unnest(p.proargtypes::oid[]) t) AS types
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1`,
        [fn],
      ),
    )
  ).rows;
  const keys = Object.keys(args);
  const match = found
    .filter((p) => {
      const names = p.proargnames || [];
      const required = names.slice(0, p.pronargs - p.pronargdefaults);
      return keys.every((k) => names.includes(k)) && required.every((n) => keys.includes(n));
    })
    .sort((a, b) => b.pronargs - a.pronargs)[0];
  if (!match)
    return [
      404,
      {
        code: 'PGRST202',
        message: `Could not find the function public.${fn}(${keys.join(', ')}) in the schema cache`,
      },
    ];
  const params = [];
  const sql = `SELECT public.${quote(fn)}(${keys
    .map((k, i) => {
      const type = match.types[match.proargnames.indexOf(k)];
      const v = args[k];
      params.push(/\[\]$/.test(type) ? arrayLiteral(v) : type.startsWith('json') ? JSON.stringify(v) : v);
      return `${quote(k)} => $${i + 1}::${type}`;
    })
    .join(',')}) AS value`;
  try {
    const rows = await inRole(role, sub, (tx) => tx.query(sql, params));
    return match.ret === 'void' ? [204, null] : [200, rows.rows[0].value];
  } catch (e) {
    return pgError(e);
  }
}

// ---------- REST: tables and views ----------
function parseOr(text) {
  const inner = text.replace(/^\(/, '').replace(/\)$/, '');
  const parts = [];
  let depth = 0,
    cur = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function condition(column, expr, params) {
  if (!identifier.test(column)) throw Error('Bad column');
  const [op, ...rest] = expr.split('.');
  const value = rest.join('.');
  const col = quote(column);
  params.push(value);
  const p = '$' + params.length;
  switch (op) {
    case 'eq':
      return `${col}::text = ${p}`;
    case 'neq':
      return `${col}::text <> ${p}`;
    case 'ilike':
      return `${col}::text ILIKE ${p}`;
    case 'like':
      return `${col}::text LIKE ${p}`;
    case 'gt':
      return `${col} > ${p}`;
    case 'gte':
      return `${col} >= ${p}`;
    case 'lt':
      return `${col} < ${p}`;
    case 'lte':
      return `${col} <= ${p}`;
    case 'is':
      params.pop();
      return `${col} IS ${value === 'null' ? 'NULL' : value === 'true' ? 'TRUE' : 'FALSE'}`;
    default:
      throw Error('Unsupported filter ' + op);
  }
}
async function table(name, url, req, role, sub) {
  if (!identifier.test(name)) return [404, {message: 'Not found'}];
  const params = [];
  const where = [];
  let order = '',
    limit = '',
    offset = '';
  let columns = '*';
  for (const [key, raw] of url.searchParams) {
    if (key === 'select')
      columns =
        raw === '*'
          ? '*'
          : raw
              .split(',')
              .map((c) => quote(c.trim().split(':')[0]))
              .join(',');
    else if (key === 'order')
      order =
        ' ORDER BY ' +
        raw
          .split(',')
          .map((o) => {
            const [c, d] = o.split('.');
            return `${quote(c)} ${d === 'desc' ? 'DESC' : 'ASC'}`;
          })
          .join(',');
    else if (key === 'limit') limit = ` LIMIT ${Number(raw) | 0}`;
    else if (key === 'offset') offset = ` OFFSET ${Number(raw) | 0}`;
    else if (key === 'or')
      where.push(
        '(' +
          parseOr(raw)
            .map((c) => {
              const [col, ...e] = c.split('.');
              return condition(col, e.join('.'), params);
            })
            .join(' OR ') +
          ')',
      );
    else where.push(condition(key, raw, params));
  }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const wantsCount = /count=exact/.test(req.headers.prefer || '');
  const single = /vnd\.pgrst\.object/.test(req.headers.accept || '');
  try {
    const result = await inRole(role, sub, async (tx) => {
      const rows = (
        await tx.query(`SELECT ${columns} FROM public.${quote(name)}${w}${order}${limit}${offset}`, params)
      ).rows;
      const total = wantsCount
        ? (await tx.query(`SELECT count(*)::int AS n FROM public.${quote(name)}${w}`, params)).rows[0].n
        : null;
      return {rows, total};
    });
    const range =
      result.total === null
        ? {}
        : {'Content-Range': `${result.rows.length ? `0-${result.rows.length - 1}` : '*'}/${result.total}`};
    if (single) {
      if (result.rows.length !== 1)
        return [
          406,
          {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${result.rows.length} rows`,
          },
        ];
      return [200, result.rows[0], range];
    }
    return [200, result.rows, range];
  } catch (e) {
    return pgError(e);
  }
}

// ---------- Storage ----------
const files = new Map();
const uploadTokens = new Map();
function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(.+)$/.exec(contentType || '')?.[1];
  if (!boundary) return {data: buffer, type: contentType};
  const parts = buffer
    .toString('latin1')
    .split('--' + boundary)
    .slice(1, -1);
  for (const part of parts) {
    const split = part.indexOf('\r\n\r\n');
    const head = part.slice(0, split);
    if (!/filename=/.test(head) && !/name="file"/.test(head) && parts.length > 1) continue;
    const type = /Content-Type: ([^\r\n]+)/i.exec(head)?.[1];
    return {data: Buffer.from(part.slice(split + 4, part.length - 2), 'latin1'), type};
  }
  return {data: Buffer.alloc(0), type: undefined};
}
function storeFile(path, buffer, contentType) {
  const parsed = parseMultipart(buffer, contentType);
  files.set(path, {data: parsed.data, type: parsed.type || contentType || 'application/octet-stream'});
}

// ---------- server ----------
const cors = (req) => ({
  'Access-Control-Allow-Origin': req.headers.origin || '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range,Content-Type',
});

createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  const extra = cors(req);
  const reply = (status, body, headers = {}) => send(res, status, body, {...extra, ...headers});
  try {
    if (req.method === 'OPTIONS') return reply(204, null);
    const path = url.pathname;
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    const claims = bearer ? verify(bearer) : null;
    const role = claims ? 'authenticated' : 'anon';
    const sub = claims?.sub;

    // Auth
    if (path === '/auth/v1/token') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const id = refreshTokens.get(body.refresh_token);
        const account = accounts.find((a) => a.id === id);
        return account
          ? reply(200, session(account))
          : reply(400, {error: 'invalid_grant', error_description: 'Invalid refresh token'});
      }
      const account = accounts.find((a) => a.email === String(body.email).toLowerCase());
      if (!account || passwords.get(account.email) !== body.password)
        return reply(400, {
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
          code: 400,
          msg: 'Invalid login credentials',
        });
      return reply(200, session(account));
    }
    if (path === '/auth/v1/user') {
      if (!claims) return reply(401, {code: 401, msg: 'invalid JWT', message: 'invalid JWT'});
      const account = accounts.find((a) => a.id === sub);
      if (req.method === 'PUT') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        if (body.password) passwords.set(account.email, body.password);
      }
      return reply(200, session(account).user);
    }
    if (path === '/auth/v1/logout') return reply(204, null);

    // REST
    if (path.startsWith('/rest/v1/rpc/')) {
      const args =
        req.method === 'POST'
          ? JSON.parse((await readBody(req)).toString() || '{}')
          : Object.fromEntries(url.searchParams);
      const [status, body] = await rpc(path.slice('/rest/v1/rpc/'.length), args, role, sub);
      return reply(status, body);
    }
    if (path.startsWith('/rest/v1/') && req.method === 'GET') {
      const [status, body, headers] = await table(path.slice('/rest/v1/'.length), url, req, role, sub);
      return reply(status, body, headers || {});
    }

    // Storage
    const m = /^\/storage\/v1\/object\/(?:(sign|upload\/sign|public)\/)?trust-media\/(.+)$/.exec(path);
    if (m) {
      const [, kind, objectPath] = m;
      if (kind === 'public') {
        const file = files.get(objectPath);
        return file
          ? reply(200, file.data, {'Content-Type': file.type})
          : reply(404, {message: 'Object not found'});
      }
      if (kind === 'upload/sign' && req.method === 'POST') {
        const staff =
          claims &&
          (
            await serial(() =>
              db.query("SELECT 1 FROM public.staff WHERE user_id=$1 AND active AND role='admin'", [sub]),
            )
          ).rows.length;
        if (!staff)
          return reply(403, {message: 'new row violates row-level security policy', statusCode: '403'});
        const token = randomUUID();
        uploadTokens.set(token, objectPath);
        return reply(200, {url: `/object/upload/sign/trust-media/${objectPath}?token=${token}`});
      }
      if (kind === 'upload/sign' && req.method === 'PUT') {
        const token = url.searchParams.get('token');
        if (uploadTokens.get(token) !== objectPath) return reply(403, {message: 'Invalid token'});
        uploadTokens.delete(token);
        storeFile(objectPath, await readBody(req), req.headers['content-type']);
        return reply(200, {Key: 'trust-media/' + objectPath});
      }
      if (!kind && (req.method === 'POST' || req.method === 'PUT')) {
        const staff =
          claims &&
          (
            await serial(() =>
              db.query("SELECT 1 FROM public.staff WHERE user_id=$1 AND active AND role='admin'", [sub]),
            )
          ).rows.length;
        if (!staff)
          return reply(403, {message: 'new row violates row-level security policy', statusCode: '403'});
        storeFile(objectPath, await readBody(req), req.headers['content-type']);
        return reply(200, {Key: 'trust-media/' + objectPath});
      }
    }
    if (path === '/storage/v1/object/trust-media' && req.method === 'DELETE') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      for (const p of body.prefixes || []) files.delete(p);
      return reply(
        200,
        (body.prefixes || []).map((name) => ({name})),
      );
    }
    if (path === '/__files') return reply(200, [...files.keys()]);
    if (path === '/__sql' && req.method === 'POST') {
      // Test hook: run SQL as the database owner (for example to backdate a due date).
      const {sql} = JSON.parse((await readBody(req)).toString() || '{}');
      const result = await serial(() => db.query(sql));
      return reply(200, result.rows);
    }
    if (path === '/__health') return reply(200, {ok: true});
    return reply(404, {message: 'Not found: ' + path});
  } catch (e) {
    return send(res, 500, {message: String(e?.message || e)}, extra);
  }
}).listen(PORT, () => console.log(`Local test backend ready on ${BASE}`));
