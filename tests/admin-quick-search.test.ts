import test from 'node:test';
import assert from 'node:assert/strict';
import {quickResults, searchable} from '../src/lib/admin/quick-search';

test('book results link to the exact copy search and describe status in plain words', () => {
  const [r] = quickResults('books', [
    {id: 'b1', bookName: 'Maths 9', utbn: 758, author: 'R. Rao', status: 'active'},
  ]);
  assert.equal(r.href, '/admin/books?search=758');
  assert.equal(r.detail, 'UTBN 758 · R. Rao · Available');
});

test('person and loan results open their records and tolerate missing fields', () => {
  const [p] = quickResults('people', [{id: 'p 1', name: 'Asha', type: 'donar', phone: '9876543210'}]);
  assert.equal(p.href, '/admin/people?id=p%201');
  assert.equal(p.detail, 'Donor · 9876543210');
  const [l] = quickResults('loans', [{id: 'l1', orderNo: 'LN-1', name: null, status: 'partial_return'}]);
  assert.equal(l.href, '/admin/loans?id=l1');
  assert.equal(l.detail, 'Partial return');
});

test('results are capped, rows without ids are dropped and short queries are ignored', () => {
  const rows = Array.from({length: 12}, (_, i) => ({id: i + 1, name: 'P' + i}));
  assert.equal(quickResults('people', rows).length, 5);
  assert.equal(quickResults('people', [{name: 'No id'}]).length, 0);
  assert.equal(searchable('a'), false);
  assert.equal(searchable(' ab '), true);
});
