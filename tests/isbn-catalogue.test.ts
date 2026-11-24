import test from 'node:test';
import assert from 'node:assert/strict';
import {toIsbn10, toIsbn13} from '../src/lib/admin/isbn';
import {createTestDb} from './helpers/test-db';

test('ISBN-10 and ISBN-13 convert to each other, so old and new records match', () => {
  assert.equal(toIsbn13('0-306-40615-2'), '9780306406157');
  assert.equal(toIsbn13('9780306406157'), '9780306406157');
  assert.equal(toIsbn10('9780306406157'), '0306406152');
  assert.equal(toIsbn10('9791234567896'), null);
  assert.equal(toIsbn13('9780306406158'), null);
  assert.equal(toIsbn13('abc'), null);
  assert.equal(toIsbn13('080442957x'), '9780804429573');
});

test('the trust remembers books it has entered, and the memory is for staff only', async () => {
  const t = await createTestDb();
  await t.as('operator');
  assert.equal(await t.rpc('admin_isbn_find', ['9780306406157']), null);
  await t.rpc('admin_isbn_remember', [
    {isbn: '9780306406157', title: '  Maths   Class 9 ', author: 'R. Rao', class_name: 'Class 9'},
  ]);
  const found = (await t.rpc('admin_isbn_find', ['9780306406157'])) as Record<string, unknown>;
  assert.equal(found.title, 'Maths Class 9');
  assert.equal(found.class_name, 'Class 9');
  await t.rpc('admin_isbn_remember', [
    {isbn: '9780306406157', title: 'Maths 9', author: 'R. Rao', class_name: 'Class 9'},
  ]);
  const again = (await t.rpc('admin_isbn_find', ['9780306406157'])) as Record<string, unknown>;
  assert.equal(again.title, 'Maths 9');
  assert.equal(again.times_used, 2);
  await assert.rejects(t.rpc('admin_isbn_remember', [{isbn: '123', title: 'X', author: '', class_name: ''}]));
  await assert.rejects(
    t.rpc('admin_isbn_remember', [{isbn: '9780306406157', title: '  ', author: '', class_name: ''}]),
  );
  assert.equal(await t.rpc('admin_isbn_find', ['junk']), null);
  await t.as('viewer');
  assert.ok(await t.rpc('admin_isbn_find', ['9780306406157']));
  await assert.rejects(
    t.rpc('admin_isbn_remember', [{isbn: '9780306406157', title: 'Hack', author: '', class_name: ''}]),
  );
  await t.db.exec("SELECT set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(t.rpc('admin_isbn_find', ['9780306406157']));
});
