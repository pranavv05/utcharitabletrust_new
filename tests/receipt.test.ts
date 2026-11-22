import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReceiptDocument, receiptKind, type ReceiptTrust} from '../src/components/admin/receipt';

// The test runner compiles JSX the classic way, which looks up a global React.
(globalThis as unknown as {React: typeof React}).React = React;

const trust: ReceiptTrust = {
  name: 'UT Charitable Trust',
  address: 'Shop No. 05, V-Raj Darshan, Samarwani, Silvassa – 396230',
  phone: '+91 93779 58582',
  email: 'help@utcharitabletrust.com',
};
const person = {
  name: 'Priya Patel',
  phone: '9876500002',
  email: 'priya@example.test',
  customerId: 'UTC-P-2',
  address: 'Silvassa',
};
const items = [
  {id: 'b1', utbn: 12, bookName: 'Mathematics Class 8', author: 'NCERT', class: 'Class 8'},
  {id: 'b2', utbn: 13, bookName: 'Science Class 8', author: 'NCERT', class: 'Class 8'},
];
const render = (data: Record<string, unknown>, t: ReceiptTrust = trust) =>
  renderToStaticMarkup(createElement(ReceiptDocument, {data, trust: t, logo: null, printedOn: '2026-11-22'}));

const issue = {
  orderNo: 'UTC-I-7',
  status: 'issue',
  kind: 'loan',
  issueDate: '2026-11-22',
  endDate: '2027-11-22',
  person,
  items,
};

test('an issue receipt states the 365-day rule, the late fee, loss and damage terms and has signature lines', () => {
  const html = render(issue);
  assert.match(html, /Book Issue Receipt/);
  assert.match(html, /UTC-I-7/);
  assert.match(html, /RETURN ON OR BEFORE/);
  assert.match(html, /22 November 2027/);
  assert.match(html, /365 days/);
  assert.match(html, /₹10 per day/);
  assert.match(html, /damaged/);
  assert.match(html, /current price or replace it with the same title and edition/);
  assert.match(html, /Terms and conditions/);
  assert.match(html, /नियम एवं शर्तें/);
  assert.match(html, /₹10 प्रतिदिन/);
  assert.match(html, /Borrower’s signature \(accepts the terms\)/);
  assert.match(html, /Authorised signatory/);
  assert.match(html, /ID proof/);
  assert.match(html, /Total books: <strong>2<\/strong>/);
});

test('the registration number and certification are printed only when they exist', () => {
  assert.doesNotMatch(render(issue), /Registration No\./);
  const html = render(issue, {...trust, registration: 'E/1234/Silvassa', iso: 'ISO 9001:2015'});
  assert.match(html, /Registration No\. E\/1234\/Silvassa/);
  assert.match(html, /ISO 9001:2015 certified/);
});

test('a donation receipt is a plain acknowledgement without lending terms, due date or ID proof', () => {
  const html = render({
    orderNo: 'UTC-D-4',
    status: 'new',
    kind: 'donation',
    issueDate: '2026-11-22',
    endDate: '2026-11-22',
    person,
    items,
  });
  assert.match(html, /Donation Receipt/);
  assert.match(html, /DATE RECEIVED/);
  assert.match(html, /voluntary gift/);
  assert.match(html, /Donor’s signature/);
  assert.doesNotMatch(html, /365 days/);
  assert.doesNotMatch(html, /RETURN ON OR BEFORE/);
  assert.doesNotMatch(html, /Terms and conditions/);
  assert.doesNotMatch(html, /ID proof/);
  assert.doesNotMatch(html, /tax/i);
});

test('a return receipt shows days late, the late fee and the recorded penalty instead of the terms', () => {
  const html = render({
    orderNo: 'UTC-I-7',
    status: 'return',
    kind: 'loan',
    issueDate: '2026-11-22',
    endDate: '2027-11-22',
    returnDate: '2027-12-02',
    penaltyAmount: '200',
    penaltyReason: 'Late return',
    person,
    items: items.map((b) => ({...b, disposition: 'returned', returned_at: '2027-12-02'})),
  });
  assert.match(html, /Book Return Receipt/);
  assert.doesNotMatch(html, /ID proof/);
  assert.match(html, /Days after the due date: <strong>10<\/strong>/);
  assert.match(html, /late fee at ₹10 per day: <strong>₹200<\/strong>/);
  assert.match(html, /recorded by the trust: <strong>₹200<\/strong>/);
  assert.match(html, /Late return/);
  assert.doesNotMatch(html, /Terms and conditions/);
  // Returned on time: no late fee line.
  const onTime = render({
    orderNo: 'X',
    status: 'return',
    kind: 'loan',
    issueDate: '2026-11-22',
    endDate: '2027-11-22',
    returnDate: '2027-11-01',
    person,
    items,
  });
  assert.match(onTime, /Days after the due date: <strong>0<\/strong>/);
  assert.doesNotMatch(onTime, /late fee at/);
});

test('a cancelled entry is clearly marked and carries no terms or signatures', () => {
  const html = render({...issue, status: 'cancelled'});
  assert.equal(receiptKind({...issue, status: 'cancelled'}), 'cancelled');
  assert.match(html, /Cancelled Entry/);
  assert.match(html, /cancelled and is not valid/);
  assert.doesNotMatch(html, /Terms and conditions/);
  assert.doesNotMatch(html, /Authorised signatory/);
});

test('names from the database are escaped, never printed as markup', () => {
  const html = render({...issue, person: {...person, name: '<script>alert(1)</script>'}});
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
