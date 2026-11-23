import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test('an administrator can change a copy number, safely and on the record', async () => {
  const {db, rpc, as} = await createTestDb();
  await as('admin');
  const person = (n: number, type: string) => ({
    name: 'Person ' + n,
    email: `p${n}@example.test`,
    phone: '98765432' + (10 + n),
    type,
  });
  const donor = (await rpc('admin_save', ['people', person(1, 'donar'), null, false])) as string;
  const borrower = (await rpc('admin_save', ['people', person(2, 'customer'), null, false])) as string;
  const donate = (title: string) =>
    rpc('admin_donate', [{person_id: donor, books: [{title, author: 'A', class_name: 'Class 8'}]}]);
  await donate('Atlas');
  await donate('Maths');
  await donate('Hindi');
  const copies = (
    await db.query<{id: string; utbn: number; bookName: string}>(
      'SELECT id,utbn,"bookName" FROM legacy_trust.book_lists ORDER BY utbn',
    )
  ).rows;
  assert.equal(copies.length, 3);
  const [atlas, maths, hindi] = copies;
  const change = (id: string, utbn: unknown) => rpc('admin_utbn', [{id, utbn}]);
  const current = async (id: string) =>
    (await db.query<{utbn: number}>('SELECT utbn FROM legacy_trust.book_lists WHERE id=$1', [id])).rows[0]
      .utbn;

  // A free number works and is saved.
  assert.equal(await change(atlas.id, '500'), 500);
  assert.equal(await current(atlas.id), 500);

  // The number must be a free whole number from 1 to 99999999 and different from the current one.
  await assert.rejects(() => change(maths.id, '500'), /already used by another copy/);
  await assert.rejects(() => change(atlas.id, '500'), /already has that number/);
  for (const bad of ['', '0', '-5', '12.5', 'abc', '123456789', ' ', null])
    await assert.rejects(() => change(maths.id, bad), /whole number from 1 to 99999999/);
  await assert.rejects(() => change('00000000-0000-4000-8000-000000000000', '77'), /Book not found/);

  // A copy that is out on loan cannot be renumbered until it is returned.
  const loan = (await rpc('admin_issue', [
    {person_id: borrower, book_ids: [maths.id], issue_date: today, due_date: later},
  ])) as string;
  await assert.rejects(() => change(maths.id, '600'), /Return the issued copy/);
  await rpc('admin_return', [{transaction_id: loan, book_ids: [maths.id], penalty: 0}]);
  assert.equal(await change(maths.id, '600'), 600);

  // Newly donated copies never get a number that was set by hand.
  await donate('Science');
  const science = (
    await db.query<{utbn: number}>('SELECT utbn FROM legacy_trust.book_lists WHERE "bookName"=$1', [
      'Science',
    ])
  ).rows[0].utbn;
  assert.equal(science, 601);

  // The change is written to the activity log.
  const log = await db.query<{summary: string}>(
    "SELECT summary FROM trust_admin.audit WHERE entity='books' AND summary LIKE 'UTBN changed%' ORDER BY id",
  );
  assert.deepEqual(
    log.rows.map((r) => r.summary),
    [`UTBN changed from ${atlas.utbn} to 500 · Atlas`, `UTBN changed from ${maths.utbn} to 600 · Maths`],
  );

  // Other staff cannot do it.
  await as('operator');
  await assert.rejects(() => change(hindi.id, '700'), /Administrator access required/);
  await as('viewer');
  await assert.rejects(() => change(hindi.id, '700'), /access/i);
  assert.equal(await current(hindi.id), hindi.utbn);
});

test('a copy that shares its number with another can be given a free one', async () => {
  const {db, rpc, as} = await createTestDb();
  await as('admin');
  const donor = (await rpc('admin_save', [
    'people',
    {name: 'Donor', email: 'd@example.test', phone: '9876543210', type: 'donar'},
    null,
    false,
  ])) as string;
  await rpc('admin_donate', [
    {
      person_id: donor,
      books: [
        {title: 'One', author: 'A', class_name: 'Geo'},
        {title: 'Two', author: 'B', class_name: 'Geo'},
      ],
    },
  ]);
  // Old records can contain the same number twice (the check only guards new numbers); renumbering one
  // of them resolves it.
  await db.exec('ALTER TABLE legacy_trust.book_lists DISABLE TRIGGER book_lists_unique_utbn');
  await db.query(`UPDATE legacy_trust.book_lists SET utbn=(SELECT min(utbn) FROM legacy_trust.book_lists)`);
  await db.exec('ALTER TABLE legacy_trust.book_lists ENABLE TRIGGER book_lists_unique_utbn');
  const rows = (await db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists ORDER BY "bookName"'))
    .rows;
  assert.equal(await rpc('admin_utbn', [{id: rows[1].id, utbn: '9000'}]), 9000);
  const numbers = (await db.query<{utbn: number}>('SELECT utbn FROM legacy_trust.book_lists')).rows.map(
    (r) => r.utbn,
  );
  assert.equal(new Set(numbers).size, 2);
});

test('the database itself refuses two copies with the same number', async () => {
  const {db, rpc, as} = await createTestDb();
  await as('admin');
  const donor = (await rpc('admin_save', [
    'people',
    {name: 'Donor', email: 'd2@example.test', phone: '9876543211', type: 'donar'},
    null,
    false,
  ])) as string;
  await rpc('admin_donate', [
    {
      person_id: donor,
      books: [
        {title: 'One', author: 'A', class_name: 'Geo'},
        {title: 'Two', author: 'B', class_name: 'Geo'},
      ],
    },
  ]);
  const rows = (
    await db.query<{id: string; utbn: number}>('SELECT id,utbn FROM legacy_trust.book_lists ORDER BY utbn')
  ).rows;
  // Setting a number that another copy has, by any route, fails.
  await assert.rejects(
    () => db.query('UPDATE legacy_trust.book_lists SET utbn=$1 WHERE id=$2', [rows[0].utbn, rows[1].id]),
    /already used by another copy/,
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO legacy_trust.book_lists(id,"bookName",author,class,utbn,status) VALUES(gen_random_uuid()::text,'Copy','A','Geo',$1,'active')`,
        [rows[0].utbn],
      ),
    /already used by another copy/,
  );
  // Editing other details of a book, or keeping its own number, is fine.
  await db.query(`UPDATE legacy_trust.book_lists SET "bookName"='One (2nd ed.)' WHERE id=$1`, [rows[0].id]);
  await db.query('UPDATE legacy_trust.book_lists SET utbn=$1 WHERE id=$2', [rows[0].utbn, rows[0].id]);
  const numbers = (await db.query<{utbn: number}>('SELECT utbn FROM legacy_trust.book_lists')).rows.map(
    (r) => r.utbn,
  );
  assert.equal(new Set(numbers).size, numbers.length);
});
