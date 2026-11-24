'use client';
import {renewalMin} from '@/lib/admin/dates';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {send} from './workspace';
import {display, type Row} from '@/lib/admin/config';
export function PersonProfile({
  id,
  isAdmin = false,
  onChanged,
}: {
  id: string;
  isAdmin?: boolean;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((x) => x + 1);
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/admin/person?id=' + encodeURIComponent(id), {signal: c.signal})
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, revision]);
  return error ? (
    <p role="alert">{error}</p>
  ) : !data ? (
    <p>Loading person…</p>
  ) : (
    <>
      <dl className="admin-detail-list">
        <div>
          <dt>Person ID</dt>
          <dd>{display(data.customerId)}</dd>
        </div>
        {['name', 'phone', 'email', 'address'].map((k) => (
          <div key={k}>
            <dt>
              {k === 'name' ? 'Name' : k === 'phone' ? 'Phone' : k === 'email' ? 'Email address' : 'Address'}
            </dt>
            <dd>{display(data[k])}</dd>
          </div>
        ))}
        <div>
          <dt>Role</dt>
          <dd>
            {Number(data.donations) > 0 && <span className="admin-badge status-active">Donor</span>}{' '}
            {Number(data.borrowings) > 0 && <span className="admin-badge status-new">Borrower</span>}
            {!Number(data.donations) && !Number(data.borrowings) && 'No donations or issued books yet'}
          </dd>
        </div>
        <div>
          <dt>Books donated</dt>
          <dd>{display(data.books_donated)}</dd>
        </div>
        <div>
          <dt>Books not yet returned</dt>
          <dd>{display(data.outstanding)}</dd>
        </div>
      </dl>
      {Array.isArray(data.possible_duplicates) && (data.possible_duplicates as Row[]).length > 0 && (
        <DuplicatesOfPerson
          person={data}
          others={data.possible_duplicates as Row[]}
          isAdmin={isAdmin}
          onChanged={() => {
            setRevision((x) => x + 1);
            onChanged?.();
          }}
        />
      )}
      <h3 className="admin-subheading">Transaction history</h3>
      <p className="admin-form-help">Latest 200 transactions. Open a reference to see copies and receipts.</p>
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Due</th>
              <th>Copies</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data.transactions as Row[]).map((t) => (
              <tr key={String(t.id)}>
                <td>
                  <Link className="admin-record-link" href={'/admin/loans?id=' + t.id}>
                    {display(t.orderNo)}
                  </Link>
                </td>
                <td>{display(t.issueDate)}</td>
                <td>{display(t.endDate)}</td>
                <td>{display(t.copies)}</td>
                <td>{t.status === 'new' ? 'Donation received' : display(t.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!(data.transactions as Row[]).length && <p>No transactions yet.</p>}
      </div>
    </>
  );
}
export function LoanTools({
  id,
  data,
  canWrite,
  onChanged,
}: {
  id: string;
  data: Row;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const open = ['issue', 'partial_return'].includes(String(data.status));
  async function submit(e: React.FormEvent<HTMLFormElement>, entity: string) {
    e.preventDefault();
    const form = e.currentTarget;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await send(entity, {...Object.fromEntries(new FormData(form)), transaction_id: id});
      form.reset();
      setNotice(entity === 'renew' ? 'Due date updated.' : 'Follow-up saved.');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-loan-tools">
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-notice success">
          {notice}
        </p>
      )}
      {canWrite && open && (
        <div className="admin-settings-grid">
          <form className="admin-form" onSubmit={(e) => submit(e, 'renew')}>
            <h3>Renew this issue</h3>
            <label>
              New due date
              <input type="date" name="due_date" required min={renewalMin(data.endDate)} />
            </label>
            <label>
              Reason
              <textarea name="reason" required minLength={3} maxLength={1000} />
            </label>
            <button disabled={busy} className="admin-button secondary">
              Save renewal
            </button>
          </form>
          <form className="admin-form" onSubmit={(e) => submit(e, 'followup')}>
            <h3>Record borrower follow-up</h3>
            <label>
              Contact method
              <select name="channel">
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="in_person">In person</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              What happened?
              <textarea name="note" required minLength={3} maxLength={2000} />
            </label>
            <p className="admin-form-help">
              Records a conversation or attempt. This does not send a message.
            </p>
            <button disabled={busy} className="admin-button secondary">
              Save follow-up
            </button>
          </form>
        </div>
      )}
      <h3>Follow-up history</h3>
      {((data.followups as Row[]) || []).map((f, i) => (
        <article className="admin-followup" key={i}>
          <strong>
            {display(f.channel)} · {display(f.name)}
          </strong>
          <small>{new Date(String(f.created_at)).toLocaleString('en-IN')}</small>
          <p>{display(f.note)}</p>
        </article>
      ))}
      {!((data.followups as Row[]) || []).length && (
        <p className="admin-form-help">No follow-ups recorded.</p>
      )}
    </section>
  );
}
export function ApplicationApproval({row, onDone}: {row: Row; onDone: () => void}) {
  const [info, setInfo] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/application?id=' + row.id)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.message);
        setInfo(d);
      })
      .catch((e) => setError(e.message));
  }, [row.id]);
  async function approve() {
    setBusy(true);
    setError('');
    try {
      await send('approve', {submission_id: row.id, existing_member_id: (info?.existing_member as Row)?.id});
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-inline-create">
      <h3>Membership decision</h3>
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
      {!info ? (
        <p>Checking member records…</p>
      ) : info.approved_member_id ? (
        <p>
          This application has already been approved.{' '}
          <Link href="/admin/members" className="admin-text-link">
            View members
          </Link>
        </p>
      ) : (
        <>
          {!!info.existing_member && (
            <p>
              A member with this email already exists: {display((info.existing_member as Row).name)}. Approval
              links this application to that record without overwriting it.
            </p>
          )}
          <p className="admin-form-help">
            Approve only after reviewing the application. This creates or links a community member; it does
            not grant a staff login.
          </p>
          <button
            className="admin-button primary"
            disabled={busy || row.status === 'archived'}
            onClick={approve}
          >
            {busy
              ? 'Approving…'
              : info.existing_member
                ? 'Approve and link existing member'
                : 'Approve and create member'}
          </button>
        </>
      )}
    </div>
  );
}

/** Administrators can cancel a donation or issue that was entered by mistake. The record is kept. */
export function CancelEntry({id, kind, onDone}: {id: string; kind: 'donation' | 'loan'; onDone: () => void}) {
  const [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const noun = kind === 'donation' ? 'donation' : 'issue';
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await send('cancel', {transaction_id: id, reason});
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-cancel-entry">
      <form className="admin-form" onSubmit={submit}>
        <h3>Cancel this {noun}</h3>
        <p className="admin-form-help">
          {kind === 'donation'
            ? 'Use this if the donation was entered by mistake. Its copies are archived (only possible while none of them has been issued). The entry stays in history marked Cancelled, and reports no longer count it. Book numbers already assigned are not reused.'
            : 'Use this if the issue was entered by mistake (only possible while nothing has been returned). The copies go back on the shelf. The entry stays in history marked Cancelled, and reports no longer count it.'}
        </p>
        <label>
          Reason (required)
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="admin-checkbox-label">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I
          understand this cannot be undone.
        </label>
        {error && (
          <p role="alert" className="admin-notice error">
            {error}
          </p>
        )}
        <button className="admin-button danger" disabled={busy || !confirmed || reason.trim().length < 10}>
          {busy ? 'Cancelling…' : 'Cancel this ' + noun}
        </button>
      </form>
    </section>
  );
}

/** Other entries that may be the same person as this one, with a merge for administrators. */
function DuplicatesOfPerson({
  person,
  others,
  isAdmin,
  onChanged,
}: {
  person: Row;
  others: Row[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [asking, setAsking] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function merge() {
    if (!asking) return;
    setBusy(true);
    setError('');
    try {
      await send('merge', {keep_id: person.id, remove_id: asking.id});
      setAsking(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-duplicate-group" aria-label="Entries that may be the same person">
      <h3 className="admin-subheading">May be the same person</h3>
      <p className="admin-form-help">
        These entries share this person&apos;s phone, email or name. A family often shares a phone, so check
        before merging.
      </p>
      <ul>
        {others.map((o) => (
          <li key={String(o.id)}>
            <span>
              <Link className="admin-record-link" href={'/admin/people?id=' + o.id}>
                {display(o.name)}
              </Link>{' '}
              ({display(o.customerId)})
              <small>
                {display(o.phone)} · {display(o.email)} · {display(o.reason)}
              </small>
            </span>
            {isAdmin && (
              <button type="button" className="admin-button secondary" onClick={() => setAsking(o)}>
                Merge into this person
              </button>
            )}
          </li>
        ))}
      </ul>
      {asking && (
        <div className="admin-notice error" role="alertdialog" aria-label="Confirm merge">
          <p>
            Merge <strong>{display(asking.name)}</strong> ({display(asking.customerId)}) into{' '}
            <strong>{display(person.name)}</strong>? Their donations, issues and books move to{' '}
            {display(person.name)} and the other entry is removed. This cannot be undone.
          </p>
          <div className="admin-person-match-actions">
            <button type="button" className="admin-button primary" disabled={busy} onClick={merge}>
              {busy ? 'Merging…' : 'Yes, merge'}
            </button>
            <button
              type="button"
              className="admin-button secondary"
              disabled={busy}
              onClick={() => setAsking(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
    </section>
  );
}
