import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test('a mistaken issue or donation can be cancelled with a reason and stays in history', async () => {
  const {db, rpc, as} = await createTestDb();
  try {
    await as('admin');
    const person = (n: number, type: string) => ({
      name: 'Person ' + n,
      email: `p${n}@example.test`,
      phone: '98765432' + (10 + n),
      type,
    });
    const donor = (await rpc('admin_save', ['people', person(1, 'donar'), null, false])) as string;
    const borrower = (await rpc('admin_save', ['people', person(2, 'customer'), null, false])) as string;
    const donation = (await rpc('admin_donate', [
      {
        person_id: donor,
        books: [
          {title: 'Atlas', author: 'A', class_name: 'Geo'},
          {title: 'Maths', author: 'B', class_name: 'Class 8'},
        ],
      },
    ])) as string;
    const copies = (
      await db.query<{id: string; utbn: number}>('SELECT id,utbn FROM legacy_trust.book_lists ORDER BY utbn')
    ).rows;
    const status = async (id: string) =>
      (await db.query<{status: string}>('SELECT status FROM legacy_trust.book_lists WHERE id=$1', [id]))
        .rows[0].status;
    const bookingStatus = async (id: string) =>
      (await db.query<{status: string}>('SELECT status FROM legacy_trust.bookings WHERE id=$1', [id])).rows[0]
        .status;

    // Issue a copy by mistake, then cancel it: the copy goes back on the shelf.
    const issue = (await rpc('admin_issue', [
      {person_id: borrower, book_ids: [copies[0].id], issue_date: today, due_date: later},
    ])) as string;
    assert.equal(await status(copies[0].id), 'issue');
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: issue, reason: 'short'}]),
      /10 to 500 characters/,
    );
    await rpc('admin_cancel', [{transaction_id: issue, reason: 'Issued to the wrong borrower'}]);
    assert.equal(await status(copies[0].id), 'active');
    assert.equal(await bookingStatus(issue), 'cancelled');
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: issue, reason: 'Trying to cancel twice'}]),
      /already cancelled/,
    );
    // The copy can be issued again, and the cancelled entry no longer counts in reports.
    const reissue = (await rpc('admin_issue', [
      {person_id: borrower, book_ids: [copies[0].id], issue_date: today, due_date: later},
    ])) as string;
    const report = (await rpc('admin_report', ['loans', today, today])) as {
      rows: {reference: string}[];
      total: number;
    };
    assert.equal(report.total, 1);
    const cancelledRef = (
      await db.query<{o: string}>('SELECT "orderNo" AS o FROM legacy_trust.bookings WHERE id=$1', [issue])
    ).rows[0].o;
    assert.ok(!report.rows.some((r) => r.reference === cancelledRef));
    // An issue with a return cannot be cancelled.
    await rpc('admin_return', [{transaction_id: reissue, book_ids: [copies[0].id], penalty: 0}]);
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: reissue, reason: 'Already returned today'}]),
      /nothing returned yet/,
    );

    // A donation whose copies were issued before cannot be cancelled; unused ones can, and are archived.
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: donation, reason: 'Donor changed their mind'}]),
      /issued before/,
    );
    const second = (await rpc('admin_donate', [
      {person_id: donor, books: [{title: 'Extra', author: 'C', class_name: 'Art'}]},
    ])) as string;
    const extra = (
      await db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists WHERE "bookName"=\'Extra\'')
    ).rows[0].id;
    await rpc('admin_cancel', [{transaction_id: second, reason: 'Entered twice by mistake'}]);
    assert.equal(await status(extra), 'inactive');
    assert.equal(await bookingStatus(second), 'cancelled');
    const donations = (await rpc('admin_report', ['donations', today, today])) as {total: number};
    assert.equal(donations.total, 1);
    // The cancellation keeps who, when and why.
    const kept = (
      await db.query<{reason: string; previous_status: string}>(
        'SELECT reason,previous_status FROM trust_admin.cancellations WHERE booking_id=$1',
        [second],
      )
    ).rows[0];
    assert.deepEqual(kept, {reason: 'Entered twice by mistake', previous_status: 'new'});
    assert.equal(
      (await db.query("SELECT 1 FROM trust_admin.audit WHERE action='cancel' AND record_id=$1", [second]))
        .rows.length,
      1,
    );

    // Only administrators may cancel.
    await as('operator');
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: reissue, reason: 'Operator should not'}]),
      /Administrator access required/,
    );
    await as('viewer');
    await assert.rejects(
      () => rpc('admin_cancel', [{transaction_id: reissue, reason: 'Viewer should not'}]),
      /Staff access required/,
    );
  } finally {
    await db.close();
  }
});
