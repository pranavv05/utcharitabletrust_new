import test from 'node:test';
import assert from 'node:assert/strict';
import {columnLabel, reportPresets, summarizeReport} from '../src/lib/admin/report-summary';

test('presets follow the India calendar and the April financial year', () => {
  const p = Object.fromEntries(reportPresets(new Date('2026-11-22T10:00:00Z')).map((x) => [x.id, x]));
  assert.deepEqual([p.month.from, p.month.to], ['2026-11-01', '2026-11-22']);
  assert.deepEqual([p['last-month'].from, p['last-month'].to], ['2026-10-01', '2026-10-31']);
  assert.deepEqual([p['30'].from, p['30'].to], ['2026-10-24', '2026-11-22']);
  assert.deepEqual([p.fy.from, p.fy.to], ['2026-04-01', '2026-11-22']);
  assert.deepEqual([p['last-fy'].from, p['last-fy'].to], ['2025-04-01', '2026-03-31']);
});

test('before April the financial year started in the previous calendar year, and ranges stay within 366 days', () => {
  const presets = reportPresets(new Date('2027-02-10T10:00:00Z'));
  const fy = presets.find((x) => x.id === 'fy')!;
  assert.equal(fy.from, '2026-04-01');
  const lastMonth = presets.find((x) => x.id === 'last-month')!;
  assert.deepEqual([lastMonth.from, lastMonth.to], ['2027-01-01', '2027-01-31']);
  for (const x of presets) {
    const days = (Date.parse(x.to) - Date.parse(x.from)) / 86400000;
    assert.ok(days >= 0 && days <= 366, x.id);
  }
});

test('January presets cross the year boundary correctly', () => {
  const p = Object.fromEntries(reportPresets(new Date('2027-01-05T10:00:00Z')).map((x) => [x.id, x]));
  assert.deepEqual([p['last-month'].from, p['last-month'].to], ['2026-12-01', '2026-12-31']);
});

test('summary totals copies, people and statuses, ranking people by copies', () => {
  const s = summarizeReport([
    {name: 'Asha', copies: 3, status: 'issue'},
    {name: 'Ravi', copies: 1, status: 'return'},
    {name: 'Asha', copies: 2, status: 'issue'},
    {name: null, copies: '4', status: 'lost'},
  ]);
  assert.equal(s.records, 4);
  assert.equal(s.copies, 10);
  assert.equal(s.people, 3);
  assert.deepEqual(s.topPeople[0], {name: 'Asha', count: 5});
  assert.deepEqual(s.byStatus[0], {status: 'issue', count: 2});
});

test('rows without a copies column count one per record and give no copy total', () => {
  const s = summarizeReport([
    {name: 'Asha', status: 'returned'},
    {name: 'Asha', status: 'lost'},
  ]);
  assert.equal(s.copies, null);
  assert.deepEqual(s.topPeople, [{name: 'Asha', count: 2}]);
  assert.equal(summarizeReport([]).records, 0);
});

test('column labels are readable and unknown keys are tidied', () => {
  assert.equal(columnLabel('due'), 'Due date');
  assert.equal(columnLabel('some_key'), 'some key');
});

test('report columns read reference, person, dates, copies, then status', async () => {
  const {orderColumns} = await import('../src/lib/admin/report-summary');
  assert.deepEqual(orderColumns(['due', 'date', 'name', 'copies', 'status', 'reference']), [
    'reference',
    'name',
    'date',
    'due',
    'copies',
    'status',
  ]);
  assert.deepEqual(orderColumns(['status', 'title', 'utbn', 'date', 'name', 'reference']), [
    'reference',
    'name',
    'date',
    'utbn',
    'title',
    'status',
  ]);
  assert.deepEqual(orderColumns(['zzz', 'aaa', 'reference']), ['reference', 'aaa', 'zzz']);
});
