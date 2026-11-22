import Link from 'next/link';
import {
  BookOpen,
  BookCheck,
  ArrowLeftRight,
  Clock3,
  Plus,
  Inbox,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import {display, type Row} from '@/lib/admin/config';
import {daysOverdue} from '@/lib/admin/dates';
export function Badge({status}: {status: unknown}) {
  return <span className={'admin-badge status-' + String(status)}>{display(status)}</span>;
}
export function Dashboard({
  data,
  name,
  canWrite,
  overdue = [],
  inbox = [],
  month = {loans: null, donations: null},
}: {
  data: Row;
  name: string;
  canWrite: boolean;
  overdue?: Row[];
  inbox?: Row[];
  month?: {loans: number | null; donations: number | null};
}) {
  const n = (key: string) => Number(data[key] || 0);
  const number = (key: string) => n(key).toLocaleString('en-IN');
  const recent = (data.recent || []) as Row[];
  const activity = (data.activity || []) as Row[];
  const stats = [
    {
      key: 'books',
      label: 'Total book copies',
      caption: 'Every copy in our collection',
      Icon: BookOpen,
      color: 'blue',
    },
    {
      key: 'available',
      label: 'Available to borrow',
      caption: 'Ready for their next reader',
      Icon: BookCheck,
      color: 'green',
    },
    {
      key: 'issued',
      label: 'Currently issued',
      caption: 'Learning beyond our shelves',
      Icon: ArrowLeftRight,
      color: 'gold',
    },
    {
      key: 'overdue',
      label: 'Overdue books',
      caption: 'Outstanding beyond due date',
      Icon: Clock3,
      color: 'coral',
    },
  ];
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">YOUR WORKSPACE, AT A GLANCE</p>
          <h1>Welcome back, {name.split(' ')[0]}.</h1>
          <p>Here’s where the book bank stands today.</p>
        </div>
        <span className="admin-date">
          {new Intl.DateTimeFormat('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Kolkata',
          }).format(new Date())}
        </span>
      </div>
      <div className="admin-stat-grid">
        {stats.map(({key, label, caption, Icon, color}) => (
          <div className={'admin-stat ' + color} key={key}>
            <div>
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <strong>{number(key)}</strong>
            <small>{caption}</small>
          </div>
        ))}
      </div>
      <p className="admin-month-strip" aria-label="This month">
        <span>This month</span>
        <Link href="/admin/reports">
          <b>{month.loans === null ? '—' : month.loans.toLocaleString('en-IN')}</b>{' '}
          {month.loans === 1 ? 'book' : 'books'} issued
        </Link>
        <Link href="/admin/reports">
          <b>{month.donations === null ? '—' : month.donations.toLocaleString('en-IN')}</b>{' '}
          {month.donations === 1 ? 'donation' : 'donations'} received
        </Link>
      </p>
      <div className="admin-overview-grid">
        <section className="admin-card admin-action-card">
          <div className="admin-action-symbol">
            <HeartHandshake size={30} />
          </div>
          <p className="admin-eyebrow">ONE BOOK. ANOTHER OPPORTUNITY.</p>
          <h2>
            Keep the next
            <br />
            chapter moving.
          </h2>
          <p>Register a contribution or put the right book in a reader’s hands.</p>
          <div>
            {canWrite ? (
              <>
                <Link className="admin-button white" href="/admin/loans?action=issue">
                  <ArrowLeftRight size={17} /> Issue books
                </Link>
                <Link className="admin-button transparent" href="/admin/donations?action=donate">
                  <Plus size={17} /> Add donation
                </Link>
                <Link className="admin-button transparent" href="/admin/returns">
                  Return books
                </Link>
              </>
            ) : (
              <Link className="admin-button white" href="/admin/books">
                Explore inventory
              </Link>
            )}
          </div>
        </section>
        <section className="admin-card admin-circulation">
          <div className="admin-card-heading">
            <h2>Our collection</h2>
            <BookOpen size={19} />
          </div>
          <strong>
            {number('books')} <span>book copies</span>
          </strong>
          <div
            className="admin-collection-bar"
            aria-label={`${number('available')} available; ${number('issued')} issued; ${number('lost')} lost`}
          >
            <span style={{width: `${(n('available') / Math.max(n('books'), 1)) * 100}%`}} />
            <span style={{width: `${(n('issued') / Math.max(n('books'), 1)) * 100}%`}} />
            <span style={{width: `${(n('lost') / Math.max(n('books'), 1)) * 100}%`}} />
          </div>
          <div className="admin-collection-legend">
            <span>
              <i className="green" />
              Available <b>{number('available')}</b>
            </span>
            <span>
              <i className="gold" />
              Issued <b>{number('issued')}</b>
            </span>
            <span>
              <i className="coral" />
              Lost <b>{number('lost')}</b>
            </span>
          </div>
          <div className="admin-community-counts">
            <span>
              <b>{number('donors')}</b> donors
            </span>
            <span>
              <b>{number('borrowers')}</b> borrowers
            </span>
            <span>
              <b>{number('members')}</b> members
            </span>
          </div>
        </section>
      </div>
      <div className="admin-overview-grid lower">
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>Recent transactions</h2>
              <p>Donations, issues and returns</p>
            </div>
            <Link href="/admin/loans">View all</Link>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Person</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={String(row.id)}>
                    <td>
                      <Link className="admin-record-link" href={'/admin/loans?id=' + row.id}>
                        {String(row.orderNo)}
                      </Link>
                    </td>
                    <td>{display(row.name)}</td>
                    <td>{display(row.issueDate)}</td>
                    <td>
                      <Badge status={row.status === 'new' ? 'Donation received' : row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recent.length && <p className="admin-empty-inline">No transactions yet.</p>}
          </div>
        </section>
        <section className="admin-priorities">
          <div className="admin-card">
            <div className="admin-card-heading">
              <h2>Needs your attention</h2>
              <Inbox size={19} />
            </div>
            <Link className="admin-priority-link" href="/admin/submissions?filter=new">
              <span>
                <b>{number('submissions')}</b> new messages
              </span>
              <span>Open inbox</span>
            </Link>
            {inbox.map((m) => (
              <Link className="admin-attention-row" key={String(m.id)} href="/admin/submissions?filter=new">
                <span>
                  <b>{display(m.name)}</b>
                  <small>{m.kind === 'membership' ? 'Membership application' : display(m.subject)}</small>
                </span>
                <small>
                  {m.created_at ? new Date(String(m.created_at)).toLocaleDateString('en-IN') : ''}
                </small>
              </Link>
            ))}
            <Link className="admin-priority-link" href="/admin/loans?filter=overdue">
              <span>
                <b>{number('overdue')}</b> overdue books
              </span>
              <span>Review overdue books</span>
            </Link>
            {overdue.map((issue) => {
              const days = daysOverdue(issue.endDate);
              return (
                <div className="admin-attention-row" key={String(issue.id)}>
                  <Link href={'/admin/loans?id=' + issue.id}>
                    <b>{display(issue.name)}</b>
                    <small>
                      {String(issue.orderNo)} ·{' '}
                      {days ? `${days} day${days === 1 ? '' : 's'} overdue` : 'overdue'}
                    </small>
                  </Link>
                  {typeof issue.phone === 'string' && issue.phone && (
                    <a className="admin-call-link" href={'tel:' + issue.phone.replace(/[^+\d]/g, '')}>
                      Call
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <div className="admin-card">
            <div className="admin-card-heading">
              <h2>Latest activity</h2>
              <CheckCircle2 size={18} />
            </div>
            {activity.length ? (
              activity.map((a, i) => (
                <div className="admin-activity-item" key={i}>
                  <span />
                  {String(a.summary)}
                  <small>{new Date(String(a.created_at)).toLocaleDateString('en-IN')}</small>
                </div>
              ))
            ) : (
              <p className="admin-empty-inline">Your team’s new actions will appear here.</p>
            )}
            <Link className="admin-text-link" href="/admin/audit">
              View activity log
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
