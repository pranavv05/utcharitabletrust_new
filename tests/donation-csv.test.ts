import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDonationCsv} from '../src/lib/admin/donation-csv';
test('donation CSV accepts BOM, quoted commas and multiline book titles', () => {
  const rows = parseDonationCsv(
    '\ufefftitle,author,class_name\n"Science, Part 1",An Author,10\n"Two\nlines",Another Author,11\n',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'Science, Part 1');
  assert.equal(rows[1].title, 'Two\nlines');
});
test('donation CSV rejects empty fields and long text without truncating it', () => {
  assert.throws(() => parseDonationCsv('title,author,class_name\nBook,,10'), /Row 2/);
  assert.throws(
    () => parseDonationCsv('title,author,class_name\n' + 'B'.repeat(251) + ',Author,10'),
    /250 characters/,
  );
  assert.throws(() => parseDonationCsv('title,author\nBook,Author'), /class_name/);
});
test('donation CSV bounds copy count and byte size before accepting an import', () => {
  assert.throws(
    () => parseDonationCsv('title,author,class_name\n' + 'Book,Author,10\n'.repeat(201)),
    /1–200/,
  );
  assert.throws(() => parseDonationCsv('x'.repeat(200001)), /200 KB/);
});
