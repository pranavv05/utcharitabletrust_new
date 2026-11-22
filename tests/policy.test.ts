import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISSUE_DAYS,
  LATE_FEE_PER_DAY,
  addDays,
  daysLate,
  issueDueDate,
  issueTerms,
  lateFee,
} from '../src/lib/admin/policy';

test('the due date is exactly 365 days after the issue date, including across leap days', () => {
  assert.equal(ISSUE_DAYS, 365);
  assert.equal(issueDueDate('2026-11-22'), '2027-11-22');
  assert.equal(issueDueDate('2027-03-01'), '2028-02-29'); // the leap day falls inside the 365 days
  assert.equal(issueDueDate('2027-12-31'), '2028-12-30');
  assert.equal(issueDueDate('2028-01-01'), '2028-12-31'); // 2028 is a leap year: 365 days is one day short of a year
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.throws(() => addDays('not a date', 1), /Invalid date/);
});

test('late fees are ten rupees for every day after the due date and nothing on or before it', () => {
  assert.equal(LATE_FEE_PER_DAY, 10);
  assert.equal(daysLate('2027-11-22', '2027-11-22'), 0);
  assert.equal(daysLate('2027-11-22', '2027-11-01'), 0);
  assert.equal(daysLate('2027-11-22', '2027-11-23'), 1);
  assert.equal(daysLate('2027-02-27', '2027-03-02'), 3);
  assert.equal(lateFee('2027-11-22', '2027-12-02'), 100);
  assert.equal(lateFee('2027-11-22', '2027-12-02', 3), 300);
  assert.equal(lateFee('2027-11-22', '2027-11-20', 2), 0);
  assert.equal(lateFee(null, '2027-12-02'), 0);
  assert.equal(lateFee('2027-11-22', undefined), 0);
});

test('the printed terms state the 365 days, the ten rupee late fee and the loss and damage rule in both languages', () => {
  const english = issueTerms.map((t) => t.en).join(' ');
  const hindi = issueTerms.map((t) => t.hi).join(' ');
  assert.match(english, /365 days/);
  assert.match(english, /₹10 per day/);
  assert.match(english, /damaged/);
  assert.match(english, /lost/);
  assert.match(hindi, /365/);
  assert.match(hindi, /₹10/);
  assert.ok(issueTerms.every((t) => t.en.length > 20 && t.hi.length > 20));
});
