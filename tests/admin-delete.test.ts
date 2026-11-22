import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

test('restore and delete follow the archive-if-used rules', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    let seq = 0;
    const person = (n: string, type = 'customer') => ({
      name: 'Person ' + n,
      email: n + '@example.test',
      phone: '98765432' + String(10 + ++seq),
      type,
    });

    // Authors/classes: unused ones can be deleted, used ones must be archived.
    const unused = (await rpc('admin_save', ['authors', {title: 'Unused Author'}, null, false])) as string;
    await rpc('admin_delete', ['authors', unused]);
    await assert.rejects(() => rpc('admin_delete', ['authors', unused]), /Record not found/);

    const donor = (await rpc('admin_save', ['people', person('donor', 'donar'), null, false])) as string;
    const borrower = (await rpc('admin_save', ['people', person('borrower'), null, false])) as string;
    const spare = (await rpc('admin_save', ['people', person('spare'), null, false])) as string;
    await rpc('admin_donate', [
      {person_id: donor, books: [{title: 'Atlas', author: 'Used Author', class_name: 'Geography'}]},
    ]);

    const usedAuthor = (await rpc('admin_save', ['authors', {title: 'Used Author'}, null, false])) as string;
    await assert.rejects(() => rpc('admin_delete', ['authors', usedAuthor]), /book copies use this author/);

    // Books with donation history cannot be deleted; a donor with copies cannot be deleted either.
    const copy = (
      await db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists WHERE "bookName"=\'Atlas\'')
    ).rows[0].id;
    await assert.rejects(() => rpc('admin_delete', ['books', copy]), /Archive it instead/);
    await assert.rejects(() => rpc('admin_delete', ['people', donor]), /Archive them instead/);

    // A person who was never used can be deleted and the audit log keeps the event.
    await rpc('admin_delete', ['people', spare]);
    assert.equal(
      (await db.query('SELECT 1 FROM legacy_trust.customers WHERE id=$1', [spare])).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "SELECT 1 FROM trust_admin.audit WHERE action='delete' AND record_id=$1 AND summary='Deleted Person spare'",
          [spare],
        )
      ).rows.length,
      1,
    );

    // Archive then restore.
    await rpc('admin_save', ['people', {}, borrower, true]);
    assert.equal(
      (await db.query<{status: string}>('SELECT status FROM legacy_trust.customers WHERE id=$1', [borrower]))
        .rows[0].status,
      'inactive',
    );
    await rpc('admin_restore', ['people', borrower]);
    assert.equal(
      (await db.query<{status: string}>('SELECT status FROM legacy_trust.customers WHERE id=$1', [borrower]))
        .rows[0].status,
      'active',
    );

    // Inbox messages can be deleted; unsupported entities are refused.
    await db.exec('SET ROLE anon');
    await rpc('submit_request', [
      {
        kind: 'contact',
        name: 'Visitor',
        email: 'v@example.test',
        phone: '',
        subject: 'Volunteer',
        message: 'Hello trust team!',
      },
    ]);
    await db.exec('RESET ROLE');
    const message = (await db.query<{id: string}>('SELECT id FROM trust_admin.submissions LIMIT 1')).rows[0]
      .id;
    await rpc('admin_delete', ['submissions', message]);
    await assert.rejects(() => rpc('admin_delete', ['audit', '1']), /Unsupported operation/);
    await assert.rejects(() => rpc('admin_restore', ['loans', '1']), /Unsupported operation/);

    // Operators may restore but never permanently delete; viewers can do neither.
    await as('operator');
    await assert.rejects(() => rpc('admin_delete', ['people', borrower]), /Only an administrator/);
    await rpc('admin_save', ['people', {}, borrower, true]);
    await rpc('admin_restore', ['people', borrower]);
    await as('viewer');
    await assert.rejects(() => rpc('admin_restore', ['people', borrower]), /Staff access required/);
    await assert.rejects(() => rpc('admin_delete', ['people', borrower]), /Staff access required/);
  } finally {
    await db.close();
  }
});
