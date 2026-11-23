import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDb} from './helpers/test-db';

const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

test('student videos need a video, take Hindi or English, and can be hidden or deleted', async () => {
  const {rpc, as} = await createTestDb();
  const save = (data: object, extra: object = {}) =>
    rpc('admin_content_save', [
      {kind: 'student_voice', slug: 'asha-1', name: 'Asha', status: 'draft', data, ...extra},
    ]) as Promise<string>;
  const storage = 'https://abc.supabase.co/storage/v1/object/public/trust-media/u1/a.mp4';
  await as('admin');

  await assert.rejects(() => save({quote: 'Hi'}, {status: 'published'}), /needs a video file or a YouTube/);
  await assert.rejects(() => save({video_file: 'https://evil.example/a.mp4'}), /MP4 or WebM/);
  await assert.rejects(() => save({video_url: 'https://evil.example/x'}), /YouTube or Vimeo/);
  await assert.rejects(() => save({video_file: storage, colour: 'red'}), /Unknown field/);

  const id = await save(
    {video_file: storage, quote: 'Books helped me.', featured: 'yes', year: '2026'},
    {status: 'published'},
  );
  const link = await save(
    {video_url: 'https://youtu.be/dQw4w9WgXcQ'},
    {status: 'published', slug: 'ravi-2', name: 'Ravi'},
  );
  assert.ok(id && link);

  // Visitors see published student videos; archiving one removes it from the website at once.
  await as('operator');
  const names = async () =>
    ((await rpc('website_content')) as {kind: string; name: string}[])
      .filter((r) => r.kind === 'student_voice')
      .map((r) => r.name)
      .sort();
  assert.deepEqual(await names(), ['Asha', 'Ravi']);
  await assert.rejects(() => save({video_file: storage}, {id}), /Administrator access/);
  await as('admin');
  const row = (await rpc('admin_content', [])) as {id: string; updated_at: string}[];
  const current = row.find((r) => r.id === id)!;
  await save({video_file: storage}, {id, status: 'archived', expected_updated_at: current.updated_at});
  assert.deepEqual(await names(), ['Ravi']);
  await rpc('admin_content_delete', [link]);
  assert.deepEqual(await names(), []);
});

test('the public book count counts issued copies only, not donations or cancelled entries', async () => {
  const {db, rpc, as} = await createTestDb();
  await as('admin');
  assert.deepEqual(await rpc('public_book_stats'), {issued: 0});
  const person = (n: number, type: string) => ({
    name: 'Person ' + n,
    email: `p${n}@example.test`,
    phone: '98765432' + (10 + n),
    type,
  });
  const donor = (await rpc('admin_save', ['people', person(1, 'donar'), null, false])) as string;
  const borrower = (await rpc('admin_save', ['people', person(2, 'customer'), null, false])) as string;
  await rpc('admin_donate', [
    {
      person_id: donor,
      books: [
        {title: 'Atlas', author: 'A', class_name: 'Geo'},
        {title: 'Maths', author: 'B', class_name: 'Class 8'},
        {title: 'Hindi', author: 'C', class_name: 'Class 8'},
      ],
    },
  ]);
  assert.deepEqual(await rpc('public_book_stats'), {issued: 0});
  const copies = (await db.query<{id: string}>('SELECT id FROM legacy_trust.book_lists ORDER BY utbn')).rows;
  const issue = (ids: string[]) =>
    rpc('admin_issue', [
      {person_id: borrower, book_ids: ids, issue_date: today, due_date: later},
    ]) as Promise<string>;
  const first = await issue([copies[0].id, copies[1].id]);
  assert.deepEqual(await rpc('public_book_stats'), {issued: 2});
  await issue([copies[2].id]);
  assert.deepEqual(await rpc('public_book_stats'), {issued: 3});
  await rpc('admin_cancel', [{transaction_id: first, reason: 'Issued to the wrong borrower'}]);
  assert.deepEqual(await rpc('public_book_stats'), {issued: 1});
});
