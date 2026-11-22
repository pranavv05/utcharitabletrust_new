'use client';
import {trustDate, clampRecordPage} from '@/lib/admin/dates';
import {parseDonationCsv} from '@/lib/admin/donation-csv';
import {PersonChooser} from './person-chooser';
import {LookupInput} from './lookup-input';
import {PersonProfile, LoanTools, ApplicationApproval} from './workflow-tools';
import {useEffect, useRef, useState, useId} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Archive,
  LoaderCircle,
} from 'lucide-react';
import {sections, labels, display, type Row, type Section, type Field} from '@/lib/admin/config';
import {Badge} from './dashboard';
export async function send(entity: string, body: unknown) {
  const r = await fetch('/api/admin/' + entity, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.message || 'Unable to save.');
  return data;
}
function ErrorMessage({message}: {message: string}) {
  return message ? (
    <p role="alert" className="admin-notice error">
      {message}
    </p>
  ) : null;
}
export function Dialog({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={'admin-dialog ' + (wide ? 'wide' : '')}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-dialog-heading">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      <div className="admin-dialog-body">{children}</div>
    </dialog>
  );
}
export function RecordPicker({
  entity,
  filter = '',
  selected,
  onChange,
  multiple = false,
  label,
}: {
  entity: string;
  filter?: string;
  selected: Row[];
  onChange: (rows: Row[]) => void;
  multiple?: boolean;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const id = useId();
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      fetch(`/api/admin/${entity}?search=${encodeURIComponent(query)}&filter=${filter}`, {
        signal: abort.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw Error('Could not load options.');
          return r.json();
        })
        .then((d) =>
          setRows(
            entity === 'books' && /^\d+$/.test(query.trim())
              ? d.rows.filter((r: Row) => String(r.utbn) === String(Number(query)))
              : d.rows,
          ),
        )
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [entity, query, filter]);
  function toggle(row: Row) {
    const exists = selected.some((x) => x.id === row.id);
    onChange(
      multiple
        ? exists
          ? selected.filter((x) => x.id !== row.id)
          : [...selected, row]
        : exists
          ? []
          : [row],
    );
  }
  return (
    <div className="admin-picker">
      <label htmlFor={id}>{label}</label>
      <div className="admin-search">
        <Search size={17} />
        <input
          id={id}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={entity === 'books' ? 'Search title, author or UTBN' : 'Search name, email or phone'}
        />
      </div>
      {selected.length > 0 && (
        <div className="admin-selected">
          {selected.map((row) => (
            <button key={String(row.id)} type="button" onClick={() => toggle(row)}>
              {String(row.name || row.bookName)} {row.utbn ? `· ${row.utbn}` : ''}
              <X size={13} />
            </button>
          ))}
        </div>
      )}
      <div className="admin-picker-options" aria-label={label + ' options'}>
        {loading ? (
          <span className="admin-picker-hint">Loading…</span>
        ) : (
          rows.map((row) => (
            <button
              type="button"
              key={String(row.id)}
              disabled={row.status === 'inactive'}
              aria-pressed={selected.some((x) => x.id === row.id)}
              onClick={() => toggle(row)}
            >
              <span className="admin-choice-check">
                {selected.some((x) => x.id === row.id) && <Check size={13} />}
              </span>
              <span>
                <strong>{String(row.name || row.bookName)}</strong>
                <small>
                  {entity === 'books'
                    ? `${row.author} · ${row.class} · UTBN ${row.utbn}`
                    : String(row.email || row.phone)}
                </small>
              </span>
            </button>
          ))
        )}
        {!loading && !rows.length && (
          <span className="admin-picker-hint">No matching records. Try another search.</span>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
function SaveForm({section, row, onDone}: {section: Section; row: Row | null; onDone: () => void}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fields: Field[] = sections[section].fields;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await send(section, {id: row?.id, data});
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        {fields.map((f) => (
          <label key={f.key} className={f.type === 'textarea' ? 'full' : ''}>
            {f.label}
            {f.required && <span className="admin-required"> *</span>}
            {f.options ? (
              <select name={f.key} defaultValue={String(row?.[f.key] ?? f.options[0])} required={f.required}>
                {f.options.map((x) => (
                  <option key={x} value={x}>
                    {x ? display(x) : 'Not specified'}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                name={f.key}
                defaultValue={String(row?.[f.key] || '')}
                required={f.required}
                rows={3}
                maxLength={f.key === 'purpose' ? 3000 : 400}
              />
            ) : (
              <input
                name={f.key}
                defaultValue={String(row?.[f.key] || '')}
                type={f.type || 'text'}
                required={f.required}
                maxLength={f.key === 'email' ? 254 : f.key === 'phone' ? 18 : 250}
              />
            )}
          </label>
        ))}
        <label>
          Status
          <select name="status" defaultValue={String(row?.status || 'active')}>
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
          </select>
        </label>
      </div>
      <ErrorMessage message={error} />
      <div className="admin-form-footer">
        <span>Changes are recorded in the activity log.</span>
        <button className="admin-button primary" disabled={busy}>
          {busy ? 'Saving…' : row ? 'Save changes' : 'Create record'}
        </button>
      </div>
    </form>
  );
}
function DonationForm({onDone}: {onDone: (id: string) => void}) {
  const [person, setPerson] = useState<Row[]>([]);
  const [books, setBooks] = useState([{title: '', author: '', class_name: ''}]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!person.length) {
      setError('Select a donor first.');
      return;
    }
    setBusy(true);
    try {
      const data = await send('donate', {person_id: person[0].id, books});
      onDone(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <PersonChooser type="donar" selected={person} onChange={setPerson} />
      <label className="admin-inline-create">
        Import copies from CSV
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 200000) throw Error('CSV must be under 200 KB.');
              setBooks(parseDonationCsv(await file.text()));
              setError('');
            } catch (err) {
              setError((err as Error).message);
            }
            e.target.value = '';
          }}
        />
        <small>
          Headers: title,author,class_name. Imported rows replace the unsaved copy list; review before
          registering.
        </small>
      </label>
      <div className="admin-subheading">
        <h3>Donated copies</h3>
        <span>
          {books.length} {books.length === 1 ? 'copy' : 'copies'}
        </span>
      </div>
      {books.map((book, i) => (
        <div className="admin-book-input" key={i}>
          {(['title', 'author', 'class_name'] as const).map((key) => (
            <label key={key}>
              {key === 'title' ? 'Book title' : key === 'author' ? 'Author' : 'Class / category'}
              {key === 'title' ? (
                <input
                  required
                  value={book[key]}
                  maxLength={250}
                  onChange={(e) =>
                    setBooks(books.map((b, index) => (index === i ? {...b, [key]: e.target.value} : b)))
                  }
                />
              ) : (
                <LookupInput
                  entity={key === 'author' ? 'authors' : 'classes'}
                  value={book[key]}
                  onChange={(value) =>
                    setBooks(books.map((b, index) => (index === i ? {...b, [key]: value} : b)))
                  }
                />
              )}
            </label>
          ))}
          <button
            type="button"
            title="Duplicate this copy"
            disabled={books.length >= 200}
            onClick={() => setBooks([...books, {...book}])}
          >
            Copy
          </button>
          <button
            aria-label={`Remove copy ${i + 1}`}
            type="button"
            disabled={books.length === 1}
            onClick={() => setBooks(books.filter((_, index) => index !== i))}
          >
            <X size={17} />
          </button>
        </div>
      ))}
      <button
        className="admin-button secondary"
        type="button"
        disabled={books.length >= 200}
        onClick={() => setBooks([...books, {title: '', author: '', class_name: ''}])}
      >
        <Plus size={16} /> Add another copy
      </button>
      <ErrorMessage message={error} />
      <div className="admin-form-footer">
        <span>UTBNs and a donation reference are assigned automatically.</span>
        <button className="admin-button primary" disabled={busy}>
          {busy ? 'Registering…' : 'Register donation'}
        </button>
      </div>
    </form>
  );
}
function IssueForm({onDone}: {onDone: (id: string) => void}) {
  const [person, setPerson] = useState<Row[]>([]);
  const [books, setBooks] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = trustDate();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!person.length || !books.length) {
      setError('Select a borrower and at least one available copy.');
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const data = await send('issue', {
        person_id: person[0].id,
        book_ids: books.map((b) => b.id),
        issue_date: f.get('issue_date'),
        due_date: f.get('due_date'),
      });
      onDone(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <PersonChooser type="customer" selected={person} onChange={setPerson} />
      <div className="admin-form-grid">
        <label>
          Issue date
          <input required type="date" name="issue_date" defaultValue={today} max={today} />
        </label>
        <label>
          Due date
          <input required type="date" name="due_date" min={today} />
        </label>
      </div>
      <RecordPicker
        entity="books"
        filter="active"
        label="Available copies"
        selected={books}
        onChange={(rows) => setBooks(rows.slice(0, 100))}
        multiple
      />
      <ErrorMessage message={error} />
      <div className="admin-form-footer">
        <span>{books.length} copies selected · Availability is rechecked when saved.</span>
        <button className="admin-button primary" disabled={busy}>
          {busy ? 'Issuing…' : 'Issue selected books'}
        </button>
      </div>
    </form>
  );
}
function LoanDetail({id, canWrite, onChanged}: {id: string; canWrite: boolean; onChanged: () => void}) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);
  function load() {
    fetch('/api/admin/record?id=' + encodeURIComponent(id))
      .then(async (r) => {
        if (!r.ok) throw Error('Unable to load this transaction.');
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError('');
        setSelected((previous) =>
          previous.filter((id) =>
            (d.items as Row[]).some((b) => b.id === id && !b.disposition && b.status === 'issue'),
          ),
        );
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, [id]); // Detail is reloaded after each successful return.
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected.length) {
      setError('Select the copies being returned or reported lost.');
      return;
    }
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await send('return', {
        transaction_id: id,
        book_ids: selected,
        return_date: f.get('return_date'),
        penalty: Number(f.get('penalty') || 0),
        reason: f.get('reason'),
        lost,
      });
      setSelected([]);
      load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items = (data?.items || []) as Row[];
  const person = (data?.person || {}) as Row;
  const outstanding = data && ['issue', 'partial_return'].includes(String(data.status));
  if (!data)
    return (
      <>
        <ErrorMessage message={error} />
        {!error && <p>Loading transaction…</p>}
      </>
    );
  return (
    <div>
      <div className="admin-detail-meta">
        <div>
          <small>REFERENCE</small>
          <strong>{String(data.orderNo)}</strong>
        </div>
        <div>
          <small>PERSON</small>
          <strong>{display(person.name)}</strong>
          <span>{display(person.phone)}</span>
        </div>
        <div>
          <small>STATUS</small>
          <Badge status={data.status} />
        </div>
        <div>
          <small>DATES</small>
          <strong>{display(data.issueDate)}</strong>
          <span>Due: {display(data.endDate)}</span>
        </div>
      </div>
      <form className="admin-form" onSubmit={submit}>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                {canWrite && outstanding && <th>Select</th>}
                <th>Book title</th>
                <th>UTBN</th>
                <th>Copy status</th>
                <th>This transaction</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b, i) => (
                <tr key={String(b.id) + i}>
                  {canWrite && outstanding && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'Select ' + b.bookName}
                        disabled={!!b.disposition || b.status !== 'issue'}
                        checked={selected.includes(String(b.id))}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, String(b.id)]
                              : selected.filter((id) => id !== b.id),
                          )
                        }
                      />
                    </td>
                  )}
                  <td>{String(b.bookName)}</td>
                  <td>{String(b.utbn)}</td>
                  <td>
                    <Badge status={b.status} />
                  </td>
                  <td>
                    {b.disposition
                      ? display(b.disposition)
                      : data.status === 'new'
                        ? 'Donated'
                        : outstanding
                          ? 'Outstanding'
                          : 'Historical record'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canWrite && outstanding && (
          <>
            <div className="admin-subheading">
              <h3>Record a return</h3>
              <span>{selected.length} selected</span>
            </div>
            <div className="admin-form-grid">
              <label>
                Return / loss date
                <input type="date" name="return_date" required defaultValue={trustDate()} max={trustDate()} />
              </label>
              <label>
                Manual penalty (₹)
                <input type="number" name="penalty" min="0" max="1000000" step="0.01" defaultValue="0" />
              </label>
              <label className="full">
                Penalty / loss reason
                <textarea name="reason" rows={2} maxLength={1000} />
              </label>
            </div>
            <label className="admin-checkbox-label">
              <input type="checkbox" checked={lost} onChange={(e) => setLost(e.target.checked)} /> Report
              selected copies as lost; keep them unavailable.
            </label>
            <p className="admin-form-help">
              Select a subset for a partial return. Existing issue history is retained. No penalty is
              calculated automatically.
            </p>
          </>
        )}
        <ErrorMessage message={error} />
        <div className="admin-form-footer">
          <Link className="admin-button secondary" href={'/admin/receipts/' + id} target="_blank">
            <FileText size={16} /> Print / save receipt
          </Link>
          {canWrite && outstanding && (
            <button className="admin-button primary" disabled={busy || !selected.length}>
              {busy ? 'Saving…' : lost ? 'Record lost copies' : 'Record selected return'}
            </button>
          )}
        </div>
      </form>
      <LoanTools
        id={id}
        data={data}
        canWrite={canWrite}
        onChanged={() => {
          load();
          onChanged();
        }}
      />
    </div>
  );
}
export function Workspace({
  section,
  canWrite,
  initial,
}: {
  section: Section;
  canWrite: boolean;
  initial: {rows: Row[]; total: number; page: number};
}) {
  const cfg = sections[section];
  const params = useSearchParams();
  const router = useRouter();
  const [records, setRecords] = useState(initial);
  const [search, setSearch] = useState((params.get('search') || '').slice(0, 150));
  const [filter, setFilter] = useState(params.get('filter') || '');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<string | null>(
    params.get('id') ? (section === 'people' ? 'profile' : 'detail') : params.get('action'),
  );
  const [row, setRow] = useState<Row | null>(params.get('id') ? {id: params.get('id')} : null);
  const [revision, setRevision] = useState(0);
  const configFields: Field[] = cfg.fields;
  const isTransaction = ['loans', 'donations', 'returns'].includes(section);
  useEffect(() => {
    const refresh = () => setRevision((x) => x + 1);
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, []);
  useEffect(() => {
    if (params.get('id')) {
      setRow({id: params.get('id')});
      setDialog(section === 'people' ? 'profile' : 'detail');
    } else if (params.get('action')) setDialog(params.get('action'));
  }, [params]);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/admin/${section}?page=${page}&search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}&sort=${sort}`,
        {signal: abort.signal},
      )
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw Error(data.message);
          return data;
        })
        .then((d) => {
          setRecords(d);
          setPage((p) => clampRecordPage(p, d.total));
          setError('');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setBusy(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [section, search, filter, sort, page, revision]);
  function close() {
    setDialog(null);
    setRow(null);
    if (params.size) router.replace('/admin/' + section, {scroll: false});
  }
  function saved(id?: string) {
    setNotice('Saved successfully.');
    setRevision((x) => x + 1);
    if (id) {
      setRow({id});
      setDialog('detail');
    } else close();
  }
  async function archive() {
    if (!row) return;
    setError('');
    setBusy(true);
    try {
      await send(section, {id: row.id, archive: true});
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function review(status: string) {
    if (!row) return;
    try {
      await send('submissions', {id: row.id, status});
      saved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const totalPages = Math.max(1, Math.ceil(records.total / 25));
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">
            {['authors', 'classes'].includes(section)
              ? 'DIRECTORY'
              : section === 'audit'
                ? 'ACCOUNTABILITY'
                : 'TRUST OPERATIONS'}
          </p>
          <h1>{cfg.title}</h1>
          <p>{cfg.description}</p>
        </div>
        <div className="admin-heading-actions">
          {section === 'books' && (
            <Link
              className="admin-button secondary"
              href={'/admin/labels?' + new URLSearchParams({search, filter, page: String(page), sort})}
            >
              Print QR labels
            </Link>
          )}
          {isTransaction && canWrite ? (
            <>
              {section === 'donations' ? (
                <button className="admin-button primary" onClick={() => setDialog('donate')}>
                  <Plus size={17} /> Add donation
                </button>
              ) : section === 'returns' ? (
                <span className="admin-form-help">Open a loan below to record a return.</span>
              ) : (
                <>
                  <Link className="admin-button secondary" href="/admin/returns">
                    Return books
                  </Link>
                  <button className="admin-button primary" onClick={() => setDialog('issue')}>
                    Issue books
                  </button>
                </>
              )}
            </>
          ) : section === 'books' && canWrite ? (
            <Link className="admin-button primary" href="/admin/donations?action=donate">
              <Plus size={17} /> Add donation
            </Link>
          ) : (
            canWrite &&
            configFields.length > 0 && (
              <button
                className="admin-button primary"
                onClick={() => {
                  setRow(null);
                  setDialog('edit');
                }}
              >
                <Plus size={17} /> Add {cfg.singular}
              </button>
            )
          )}
        </div>
      </div>
      {notice && (
        <p className="admin-notice success" role="status">
          <Check size={16} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X size={16} />
          </button>
        </p>
      )}
      <ErrorMessage message={error} />
      <section className="admin-card admin-records">
        <div className="admin-records-toolbar">
          <div className="admin-search">
            <Search size={18} />
            <input
              aria-label={'Search ' + cfg.title}
              placeholder={
                isTransaction
                  ? 'Borrower, reference or scan UTBN…'
                  : 'Search ' + cfg.title.toLowerCase() + '…'
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {busy && <LoaderCircle className="admin-spin" size={16} />}
          </div>
          <div className="admin-filter-controls">
            {cfg.filters.length > 0 && (
              <label>
                <SlidersHorizontal size={15} />
                <select
                  value={filter}
                  aria-label="Filter records"
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All records</option>
                  {cfg.filters.map((x) => (
                    <option key={x} value={x}>
                      {display(x)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <select
              aria-label="Sort records"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              {section === 'books' && <option value="utbn">UTBN ascending</option>}
              {isTransaction && <option value="due">Due date</option>}
            </select>
            <span>{records.total.toLocaleString('en-IN')} records</span>
          </div>
        </div>
        <div className="admin-table-scroll" aria-busy={busy}>
          <table className="admin-table">
            <thead>
              <tr>
                {cfg.columns.map((key) => (
                  <th key={key}>{labels[key] || key}</th>
                ))}
                <th>
                  <span className="admin-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {records.rows.map((r) => (
                <tr key={String(r.id)}>
                  {cfg.columns.map((key, i) => (
                    <td key={key}>
                      {key === 'status' ? (
                        <Badge
                          status={
                            section === 'donations' && r[key] === 'new'
                              ? 'Donation received'
                              : section === 'books' && r[key] === 'active'
                                ? 'Available'
                                : r[key]
                          }
                        />
                      ) : i === 0 ? (
                        <button
                          className="admin-record-link"
                          onClick={() => {
                            setRow(r);
                            setDialog(
                              isTransaction
                                ? 'detail'
                                : section === 'people'
                                  ? 'profile'
                                  : configFields.length > 0
                                    ? 'edit'
                                    : 'view',
                            );
                          }}
                        >
                          {display(r[key])}
                        </button>
                      ) : key === 'created_at' ? (
                        r[key] ? (
                          new Date(String(r[key])).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        ) : (
                          '—'
                        )
                      ) : (
                        display(r[key])
                      )}
                    </td>
                  ))}
                  <td>
                    <button
                      className="admin-row-action"
                      onClick={() => {
                        setRow(r);
                        setDialog(isTransaction ? 'detail' : configFields.length > 0 ? 'edit' : 'view');
                      }}
                    >
                      {canWrite && configFields.length ? 'Edit' : 'View'}
                    </button>
                    {canWrite && configFields.length > 0 && (
                      <button
                        className="admin-archive"
                        title="Archive record"
                        aria-label={'Archive ' + display(r.name || r.title || r.bookName)}
                        onClick={() => {
                          setRow(r);
                          setDialog('archive');
                        }}
                      >
                        <Archive size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.rows.length && (
            <div className="admin-empty">
              <Search size={28} />
              <h3>{search || filter ? 'No matching records' : 'Nothing here yet'}</h3>
              <p>
                {search || filter
                  ? 'Try another search or clear your filter.'
                  : 'New records will appear here when they are added.'}
              </p>
            </div>
          )}
        </div>
        <div className="admin-pagination">
          <span>
            {records.total
              ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, records.total)} of ${records.total}`
              : '0 records'}
          </span>
          <div>
            <button
              aria-label="Previous page"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {dialog === 'profile' && row && (
        <Dialog title="Person profile" onClose={close} wide>
          <PersonProfile id={String(row.id)} />
        </Dialog>
      )}
      {dialog === 'edit' && (
        <Dialog
          title={(row ? 'Edit ' : 'Add ') + cfg.singular}
          subtitle="Keep details accurate and up to date."
          onClose={close}
        >
          {canWrite ? (
            <SaveForm section={section} row={row} onDone={() => saved()} />
          ) : (
            <dl className="admin-detail-list">
              {Object.entries(row || {}).map(([k, v]) => (
                <div key={k}>
                  <dt>{labels[k] || k}</dt>
                  <dd>{display(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Dialog>
      )}
      {dialog === 'donate' && canWrite && (
        <Dialog
          title="Register a donation"
          subtitle="A contribution today. An opportunity tomorrow."
          onClose={close}
          wide
        >
          <DonationForm onDone={saved} />
        </Dialog>
      )}
      {dialog === 'issue' && canWrite && (
        <Dialog
          title="Issue books"
          subtitle="Choose a borrower, copies, and a due date."
          onClose={close}
          wide
        >
          <IssueForm onDone={saved} />
        </Dialog>
      )}
      {dialog === 'detail' && row && (
        <Dialog title="Transaction details" onClose={close} wide>
          <LoanDetail id={String(row.id)} canWrite={canWrite} onChanged={() => setRevision((x) => x + 1)} />
        </Dialog>
      )}
      {dialog === 'archive' && row && (
        <Dialog
          title="Archive this record?"
          subtitle="The record remains in the database and is marked inactive."
          onClose={close}
        >
          <p>Outstanding loans must be resolved before archiving people or issued copies.</p>
          <ErrorMessage message={error} />
          <div className="admin-form-footer">
            <button className="admin-button secondary" onClick={close}>
              Cancel
            </button>
            <button className="admin-button danger" disabled={busy} onClick={archive}>
              Archive record
            </button>
          </div>
        </Dialog>
      )}
      {dialog === 'view' && row && (
        <Dialog title={section === 'submissions' ? 'Message details' : 'Record details'} onClose={close}>
          <dl className="admin-detail-list">
            {Object.entries(row)
              .filter(([k]) => !['id', 'actor', 'user_id'].includes(k))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{labels[k] || display(k)}</dt>
                  <dd>{display(v)}</dd>
                </div>
              ))}
          </dl>
          {section === 'submissions' && canWrite && row.kind === 'membership' && (
            <ApplicationApproval row={row} onDone={() => saved()} />
          )}{' '}
          {section === 'submissions' && canWrite && (
            <div className="admin-form-footer">
              <button className="admin-button secondary" onClick={() => review('archived')}>
                Archive message
              </button>
              <button className="admin-button primary" onClick={() => review('reviewed')}>
                Mark as reviewed
              </button>
            </div>
          )}
          <ErrorMessage message={error} />
        </Dialog>
      )}
    </>
  );
}
