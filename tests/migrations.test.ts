import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {pendingMigrations} from '../scripts/apply-pending-migrations.mjs';
import {createTestDb} from './helpers/test-db';

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

test('pending migrations are the unapplied versions in order, never the baseline or private imports', () => {
  const files = [
    '20261120000000_legacy_trust_baseline.sql',
    '20261121000000_legacy_trust_data.private.sql',
    '20261121020000_admin_workspace.sql',
    '20261122110000_admin_delete_restore.sql',
    '20261122100000_submission_abuse_limits.sql',
    'README.md',
  ];
  assert.deepEqual(pendingMigrations(files, ['20261120000000', '20261121020000']), [
    '20261122100000_submission_abuse_limits.sql',
    '20261122110000_admin_delete_restore.sql',
  ]);
  assert.deepEqual(pendingMigrations(files, ['20261121020000', '20261122100000', '20261122110000']), []);
});

test('every committed migration file name is accepted by the migration scripts', () => {
  const names = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((f) =>
    f.endsWith('.sql'),
  );
  for (const name of names) assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/, name);
  assert.equal(new Set(names.map((n) => n.slice(0, 14))).size, names.length, 'versions are unique');
});

test('new issued-book references start with UTC-I- and are still classified as issues', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    const person = (n: number, type: string) => ({
      name: 'P' + n,
      email: `p${n}@example.test`,
      phone: '98765432' + (10 + n),
      type,
    });
    const donor = (await rpc('admin_save', ['people', person(1, 'donar'), null, false])) as string;
    const borrower = (await rpc('admin_save', ['people', person(2, 'customer'), null, false])) as string;
    const donation = (await rpc('admin_donate', [
      {person_id: donor, books: [{title: 'A', author: 'B', class_name: 'C'}]},
    ])) as string;
    const copy = (await db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists LIMIT 1')).rows[0].id;
    const issue = (await rpc('admin_issue', [
      {person_id: borrower, book_ids: [copy], issue_date: today, due_date: later},
    ])) as string;
    const ref = (id: string) =>
      db.query<{o: string; k: string}>(
        'SELECT b."orderNo" AS o,k.kind AS k FROM legacy_trust.bookings b JOIN trust_admin.transaction_kinds k ON k.booking_id=b.id WHERE b.id=$1',
        [id],
      );
    assert.match((await ref(issue)).rows[0].o, /^UTC-I-\d+$/);
    assert.equal((await ref(issue)).rows[0].k, 'loan');
    assert.match((await ref(donation)).rows[0].o, /^UTC-D-\d+$/);
    // The rewritten function keeps its permissions and timezone setting.
    const f = (
      await db.query<{proconfig: string[]; secdef: boolean}>(
        "SELECT proconfig,prosecdef AS secdef FROM pg_proc WHERE proname='admin_issue'",
      )
    ).rows[0];
    assert.ok(f.secdef);
    assert.ok(f.proconfig.some((c) => c.startsWith('TimeZone=')));
    await as('viewer');
    await assert.rejects(
      () => rpc('admin_issue', [{person_id: borrower, book_ids: [copy], due_date: later}]),
      /Staff access required/,
    );
  } finally {
    await db.close();
  }
});
