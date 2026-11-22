import type {ReactNode} from 'react';
import {display, type Row} from '@/lib/admin/config';
import {LATE_FEE_PER_DAY, acceptance, daysLate, donationNote, issueTerms, lateFee} from '@/lib/admin/policy';

export type ReceiptTrust = {
  name: string;
  address: string;
  phone: string;
  email: string;
  registration?: string;
  iso?: string;
};

type Kind = 'issue' | 'return' | 'donation' | 'cancelled';

/** Which receipt a record produces. A cancelled entry is always marked as cancelled. */
export function receiptKind(data: Row): Kind {
  if (data.status === 'cancelled') return 'cancelled';
  if (data.kind === 'donation' || data.status === 'new') return 'donation';
  return ['return', 'partial_return', 'lost', 'closed_correction'].includes(String(data.status))
    ? 'return'
    : 'issue';
}

const titles: Record<Kind, {en: string; hi: string}> = {
  issue: {en: 'Book Issue Receipt', hi: 'पुस्तक जारी करने की रसीद'},
  return: {en: 'Book Return Receipt', hi: 'पुस्तक वापसी की रसीद'},
  donation: {en: 'Donation Receipt', hi: 'दान की रसीद'},
  cancelled: {en: 'Cancelled Entry', hi: 'रद्द की गई प्रविष्टि'},
};

const rupees = (value: number) => '₹' + value.toLocaleString('en-IN');
const formatDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value.slice(0, 10) + 'T00:00:00Z'));
};

function Signature({en, hi, name}: {en: string; hi: string; name?: string}) {
  return (
    <div className="receipt-sign">
      <span className="receipt-sign-line" />
      <strong>{en}</strong>
      <small lang="hi">{hi}</small>
      {name && <em>{name}</em>}
    </div>
  );
}

export function ReceiptDocument({
  data,
  trust,
  logo,
  printedOn,
}: {
  data: Row;
  trust: ReceiptTrust;
  logo: ReactNode;
  printedOn: string;
}) {
  const kind = receiptKind(data);
  const person = (data.person || {}) as Row;
  const items = (data.items || []) as Row[];
  const title = titles[kind];
  const donor = kind === 'donation';
  const lateDays = items.reduce(
    (max, b) => Math.max(max, daysLate(data.endDate, b.returned_at || data.returnDate)),
    0,
  );
  const returnedCopies = items.filter((b) => b.disposition || data.status === 'return').length;
  const lateTotal = items.reduce(
    (sum, b) => sum + lateFee(data.endDate, b.returned_at || data.returnDate),
    0,
  );
  const penalty = Number(data.penaltyAmount || 0);
  return (
    <article className="admin-receipt receipt" aria-label={title.en}>
      <header className="receipt-head">
        <div className="receipt-brand">{logo}</div>
        <div className="receipt-trust">
          <strong>{trust.name}</strong>
          <span>{trust.address}</span>
          <span>
            {trust.phone} · {trust.email}
          </span>
          {trust.registration && <span>Registration No. {trust.registration}</span>}
          {trust.iso && <span>{trust.iso} certified</span>}
        </div>
      </header>

      <div className="receipt-title">
        <h1>{title.en}</h1>
        <span lang="hi">{title.hi}</span>
      </div>
      {kind === 'cancelled' && (
        <p className="receipt-banner">
          This entry was cancelled and is not valid. It is kept in the trust’s records for reference only.
        </p>
      )}

      <section className="receipt-meta" aria-label="Receipt details">
        <div>
          <small>RECEIPT NO.</small>
          <strong>{display(data.orderNo)}</strong>
        </div>
        <div>
          <small>{donor ? 'DATE RECEIVED' : 'DATE OF ISSUE'}</small>
          <strong>{formatDate(data.issueDate)}</strong>
        </div>
        {kind === 'issue' && (
          <div className="receipt-due">
            <small>RETURN ON OR BEFORE</small>
            <strong>{formatDate(data.endDate)}</strong>
          </div>
        )}
        {kind === 'return' && (
          <div>
            <small>RETURN DUE DATE</small>
            <strong>{formatDate(data.endDate)}</strong>
          </div>
        )}
      </section>

      <section className="receipt-party" aria-label={donor ? 'Donor' : 'Borrower'}>
        <small>{donor ? 'DONOR' : 'BORROWER'}</small>
        <strong>{display(person.name)}</strong>
        <span>
          {[person.customerId && `ID ${person.customerId}`, person.phone, person.email]
            .filter(Boolean)
            .map(String)
            .join(' · ') || '—'}
        </span>
        {person.address ? <span>{String(person.address)}</span> : null}
        {kind === 'issue' && (
          <span className="receipt-idline">
            ID proof (type and number): <i />
          </span>
        )}
      </section>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>#</th>
            <th>UTBN</th>
            <th>Book title</th>
            <th>Author</th>
            <th>Class</th>
            {kind === 'return' && <th>Returned</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((b, i) => (
            <tr key={String(b.id) + i}>
              <td>{i + 1}</td>
              <td>{display(b.utbn)}</td>
              <td>{display(b.bookName)}</td>
              <td>{display(b.author)}</td>
              <td>{display(b.class)}</td>
              {kind === 'return' && (
                <td>
                  {b.disposition ? display(b.disposition) : data.status === 'return' ? 'Returned' : 'Not yet'}
                  {b.returned_at ? ` · ${formatDate(b.returned_at)}` : ''}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={kind === 'return' ? 6 : 5}>
              Total books: <strong>{items.length}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      {kind === 'return' && (
        <section className="receipt-summary" aria-label="Return summary">
          <p>
            Books returned or closed: <strong>{returnedCopies}</strong> of {items.length}
          </p>
          <p>
            Days after the due date: <strong>{lateDays}</strong>
            {lateDays > 0 && (
              <>
                {' '}
                · late fee at {rupees(LATE_FEE_PER_DAY)} per day: <strong>{rupees(lateTotal)}</strong>
              </>
            )}
          </p>
          <p>
            Penalty or charges recorded by the trust: <strong>{rupees(penalty)}</strong>
            {data.penaltyReason ? ` (${String(data.penaltyReason)})` : ''}
          </p>
        </section>
      )}

      {kind === 'issue' && (
        <section className="receipt-terms" aria-label="Terms and conditions">
          <h2>
            Terms and conditions <span lang="hi">नियम एवं शर्तें</span>
          </h2>
          <ol>
            {issueTerms.map((term) => (
              <li key={term.en}>
                <span>{term.en}</span>
                <span lang="hi" className="receipt-hi">
                  {term.hi}
                </span>
              </li>
            ))}
          </ol>
          <p className="receipt-accept">
            {acceptance.en}
            <span lang="hi" className="receipt-hi">
              {acceptance.hi}
            </span>
          </p>
        </section>
      )}

      {kind === 'donation' && (
        <p className="receipt-note">
          {donationNote.en}
          <span lang="hi" className="receipt-hi">
            {donationNote.hi}
          </span>
        </p>
      )}

      {kind !== 'cancelled' && (
        <div className="receipt-signs">
          <Signature
            en={
              donor
                ? 'Donor’s signature'
                : kind === 'return'
                  ? 'Borrower’s signature'
                  : 'Borrower’s signature (accepts the terms)'
            }
            hi={donor ? 'दाता के हस्ताक्षर' : 'उधारकर्ता के हस्ताक्षर'}
            name={String(person.name || '')}
          />
          <Signature en="Authorised signatory" hi="अधिकृत हस्ताक्षरकर्ता" name={trust.name} />
        </div>
      )}

      <footer className="receipt-foot">
        <span>
          {trust.name} · {trust.phone} · {trust.email}
        </span>
        <small>This receipt is generated from the trust’s records on {formatDate(printedOn)}.</small>
      </footer>
    </article>
  );
}
