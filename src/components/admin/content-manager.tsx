'use client';
import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {Search, Trash2, Pencil, ExternalLink, Plus} from 'lucide-react';
import {Dialog, send} from './workspace';
import {type Row} from '@/lib/admin/config';
import {kindSpec, kindSpecs, publishIssues, slugify, type FieldSpec} from '@/lib/admin/content-kinds';
import {uploadHelp, uploadImage, uploadLarge} from '@/lib/admin/media-client';
import {yearOf} from '@/lib/media';

const PAGE = 25;
type Data = Record<string, string>;
const safeImage = (url: string) =>
  /^\/images\//.test(url) ||
  /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/trust-media\//.test(url);
const rowData = (row: Row) => (row.data || {}) as Data;
const statusLabel: Record<string, string> = {draft: 'Draft', published: 'Published', archived: 'Archived'};

export function ContentManager() {
  const [kind, setKind] = useState('news'),
    [rows, setRows] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(null),
    [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState<Row | null>(null),
    [yearDialog, setYearDialog] = useState(false),
    [year, setYear] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [yearFilter, setYearFilter] = useState(''),
    [sort, setSort] = useState('order'),
    [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const spec = kindSpec(kind);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/content');
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      setRows(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('trust:changed', refresh);
    return () => window.removeEventListener('trust:changed', refresh);
  }, []);

  const ofKind = useMemo(() => rows.filter((r) => r.kind === kind), [rows, kind]);
  const yearOfRow = (r: Row) => (spec.yearField ? yearOf(rowData(r)[spec.yearField]) : '');
  const years = useMemo(
    () => Array.from(new Set(ofKind.map(yearOfRow).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ofKind, kind],
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return ofKind
      .filter((r) => !status || r.status === status)
      .filter((r) => !yearFilter || (yearFilter === 'none' ? !yearOfRow(r) : yearOfRow(r) === yearFilter))
      .filter(
        (r) =>
          !needle ||
          [r.name, r.slug, ...Object.values(rowData(r))].some((v) =>
            String(v).toLowerCase().includes(needle),
          ),
      )
      .toSorted((a, b) =>
        sort === 'name'
          ? String(a.name).localeCompare(String(b.name))
          : sort === 'newest'
            ? (spec.yearField ? String(rowData(b)[spec.yearField] || '') : '').localeCompare(
                spec.yearField ? String(rowData(a)[spec.yearField] || '') : '',
              ) || String(b.updated_at).localeCompare(String(a.updated_at))
            : Number(a.sort_order) - Number(b.sort_order) || String(a.name).localeCompare(String(b.name)),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofKind, search, status, yearFilter, sort, kind]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(String(r.id)));

  function switchKind(next: string) {
    setKind(next);
    setSearch('');
    setStatus('');
    setYearFilter('');
    setSort('order');
    setPage(1);
    setSelected(new Set());
    setNotice('');
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError('');
    try {
      await send('content-delete', {id: deleting.id});
      setNotice(`Deleted “${deleting.name}”.`);
      setDeleting(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }
  async function applyYear() {
    setBusy(true);
    setError('');
    try {
      const data = await send('content-year', {ids: [...selected], year});
      setNotice(`Year updated on ${data.id} photograph${data.id === 1 ? '' : 's'}.`);
      setYearDialog(false);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">PUBLISH WITH CONFIDENCE</p>
          <h1>Website content</h1>
          <p>{spec.intro}</p>
        </div>
        {!spec.single && (
          <button
            className="admin-button primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus size={17} /> Add {spec.singular}
          </button>
        )}
      </div>
      <div className="admin-content-tabs" role="group" aria-label="Content type">
        {kindSpecs.map((k) => (
          <button
            className={'admin-button ' + (kind === k.kind ? 'primary' : 'secondary')}
            key={k.kind}
            aria-pressed={kind === k.kind}
            onClick={() => switchKind(k.kind)}
          >
            {k.tab}
          </button>
        ))}
      </div>
      {error && (
        <p className="admin-notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice success" role="status">
          {notice}
        </p>
      )}
      <section className="admin-card admin-records">
        <div className="admin-records-toolbar">
          <div className="admin-search">
            <Search size={18} />
            <input
              aria-label={'Search ' + spec.tab}
              placeholder={'Search ' + spec.tab.toLowerCase() + '…'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="admin-filter-controls">
            <select
              aria-label="Filter by visibility"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            {spec.yearField && (
              <select
                aria-label="Filter by year"
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
                <option value="none">No year</option>
              </select>
            )}
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="order">Display order</option>
              {spec.yearField && <option value="newest">Newest first</option>}
              <option value="name">Name A–Z</option>
            </select>
            <span>{filtered.length.toLocaleString('en-IN')} records</span>
          </div>
        </div>
        {kind === 'gallery' && (
          <div className="admin-bulk-bar">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((r) => String(r.id))) : new Set())
                }
              />{' '}
              Select all {filtered.length} shown
            </label>
            <button
              className="admin-button secondary"
              disabled={!selected.size}
              onClick={() => {
                setYear('');
                setYearDialog(true);
              }}
            >
              Set year for {selected.size || 'selected'} photographs
            </button>
          </div>
        )}
        {loading ? (
          <p>Loading content…</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  {kind === 'gallery' && (
                    <th>
                      <span className="admin-visually-hidden">Select</span>
                    </th>
                  )}
                  <th>Name</th>
                  {spec.yearField && <th>{spec.yearField === 'date' ? 'Date' : 'Year'}</th>}
                  <th>Status</th>
                  <th>Order</th>
                  <th>
                    <span className="admin-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const id = String(r.id);
                  const data = rowData(r);
                  return (
                    <tr key={id}>
                      {kind === 'gallery' && (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={'Select ' + r.name}
                            checked={selected.has(id)}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(id);
                              else next.delete(id);
                              setSelected(next);
                            }}
                          />
                        </td>
                      )}
                      <td>
                        <button
                          className="admin-record-link"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          {String(r.name)}
                        </button>
                      </td>
                      {spec.yearField && <td>{String(data[spec.yearField] || '—')}</td>}
                      <td>
                        <span
                          className={'admin-badge status-' + (r.status === 'published' ? 'active' : r.status)}
                        >
                          {statusLabel[String(r.status)] || String(r.status)}
                        </span>
                      </td>
                      <td>{String(r.sort_order)}</td>
                      <td>
                        <button
                          className="admin-row-action"
                          onClick={() => {
                            setEditing(r);
                            setOpen(true);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        {spec.publicPath && r.status === 'published' && (
                          <Link
                            className="admin-row-action"
                            href={spec.publicPath(String(r.slug))}
                            target="_blank"
                            aria-label={'View ' + r.name + ' on the website'}
                          >
                            <ExternalLink size={14} /> View
                          </Link>
                        )}
                        {!spec.single && (
                          <button
                            className="admin-archive danger"
                            title="Delete permanently"
                            aria-label={'Delete ' + r.name}
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="admin-empty-inline">
                {ofKind.length
                  ? 'No records match your search or filters.'
                  : spec.single
                    ? 'The certification record has not been created yet. Apply the latest database migration.'
                    : `No ${spec.tab.toLowerCase()} yet. Add one to get started.`}
              </p>
            )}
          </div>
        )}
        {filtered.length > PAGE && (
          <div className="admin-pagination">
            <span>
              {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, filtered.length)} of {filtered.length}
            </span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      {open && (
        <Dialog
          title={(editing ? 'Edit ' : 'Add ') + spec.singular}
          subtitle="Drafts stay off the website. Publishing makes the content visible to visitors."
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          wide
        >
          <ContentForm
            kind={kind}
            row={editing}
            busy={busy}
            setBusy={setBusy}
            onDone={async () => {
              setOpen(false);
              setNotice('Saved. Published changes update the website automatically.');
              await load();
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Delete permanently?"
          subtitle="This removes it from the website and cannot be undone. The activity log keeps a copy."
          onClose={() => setDeleting(null)}
        >
          <p>
            Delete <strong>{String(deleting.name)}</strong>? To hide it without losing it, set it to Archived
            instead.
          </p>
          <div className="admin-form-footer">
            <button className="admin-button secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button className="admin-button danger" disabled={busy} onClick={remove}>
              Delete permanently
            </button>
          </div>
        </Dialog>
      )}
      {yearDialog && (
        <Dialog
          title={`Set year for ${selected.size} photographs`}
          subtitle="Visitors can then filter the gallery by year. Leave empty to clear the year."
          onClose={() => setYearDialog(false)}
        >
          <label className="admin-form">
            Year
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="2024"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <div className="admin-form-footer">
            <button className="admin-button secondary" onClick={() => setYearDialog(false)}>
              Cancel
            </button>
            <button
              className="admin-button primary"
              disabled={busy || (year !== '' && year.length !== 4)}
              onClick={applyYear}
            >
              Apply
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function MediaField({
  field,
  value,
  onChange,
  onError,
}: {
  field: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const multiple = field.type === 'images';
  const accept =
    field.type === 'image' || multiple
      ? 'image/jpeg,image/png,image/webp'
      : field.type === 'video'
        ? 'video/mp4,video/webm'
        : 'application/pdf,image/jpeg,image/png,image/webp';
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    onError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith('image/');
        urls.push(isImage ? await uploadImage(file) : await uploadLarge(file));
      }
      onChange(multiple ? [value.trim(), ...urls].filter(Boolean).join('\n') : urls[0]);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const previews = (multiple ? value.split('\n') : [value]).map((v) => v.trim()).filter(Boolean);
  return (
    <div className="admin-media-field">
      {multiple ? (
        <textarea
          rows={3}
          value={value}
          placeholder="One uploaded photograph address per line"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={
            field.type === 'image' ? '/images/… or upload below' : 'Upload below or paste an address'
          }
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={uploading}
        aria-label={'Upload ' + field.label}
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = '';
        }}
      />
      <small>
        {uploading
          ? 'Uploading…'
          : field.type === 'file'
            ? uploadHelp.file
            : field.type === 'video'
              ? uploadHelp.video
              : uploadHelp.image}{' '}
        Uploaded files have public addresses, even on drafts, so upload only material meant for the website.
      </small>
      {previews.some(safeImage) && (
        <div className="admin-media-previews">
          {previews.filter(safeImage).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}
      {value && (
        <button type="button" className="admin-row-action" onClick={() => onChange('')}>
          Remove
        </button>
      )}
    </div>
  );
}

function ContentForm({
  kind,
  row,
  busy,
  setBusy,
  onDone,
}: {
  kind: string;
  row: Row | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
}) {
  const spec = kindSpec(kind);
  const [name, setName] = useState(String(row?.name || '')),
    [slug, setSlug] = useState(String(row?.slug || (spec.single ? 'iso-certification' : ''))),
    [data, setData] = useState<Data>(row ? rowData(row) : {}),
    [status, setStatus] = useState(String(row?.status || 'draft')),
    [order, setOrder] = useState(String(row?.sort_order ?? 0)),
    [error, setError] = useState('');
  const issues = publishIssues(kind, data, name);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === 'published' && issues.length) {
      setError('To publish, please fill in: ' + issues.join(', ') + '.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ''));
      await send('content', {
        id: row?.id,
        expected_updated_at: row?.updated_at,
        kind,
        name,
        slug,
        status,
        data: clean,
        sort_order: Number(order) || 0,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const set = (key: string, value: string) => setData((d) => ({...d, [key]: value}));
  return (
    <form className="admin-form" onSubmit={save}>
      <div className="admin-form-grid">
        <label>
          {spec.nameLabel}
          <input
            required
            maxLength={150}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!row && !spec.single) setSlug(slugify(e.target.value));
            }}
          />
        </label>
        {!spec.single && (
          <label>
            Web address ending (slug)
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={120}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
        )}
        {spec.fields.map((field) => {
          const value = data[field.key] || '';
          const wide = ['textarea', 'image', 'images', 'file', 'video'].includes(field.type);
          return (
            <label className={wide ? 'full' : ''} key={field.key}>
              {field.label}
              {field.publish && <span className="admin-required"> (needed to publish)</span>}
              {field.type === 'textarea' ? (
                <textarea
                  rows={field.rows || 3}
                  value={value}
                  maxLength={field.key === 'body' ? 12000 : 3000}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              ) : field.type === 'select' ? (
                <select
                  value={value || field.options?.[0]?.[0]}
                  onChange={(e) => set(field.key, e.target.value)}
                >
                  {field.options?.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : ['image', 'images', 'file', 'video'].includes(field.type) ? (
                <MediaField
                  field={field}
                  value={value}
                  onChange={(v) => set(field.key, v)}
                  onError={setError}
                />
              ) : (
                <input
                  type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                  inputMode={field.type === 'year' || field.type === 'number' ? 'numeric' : undefined}
                  maxLength={field.type === 'year' ? 4 : 1000}
                  value={value}
                  onChange={(e) =>
                    set(
                      field.key,
                      field.type === 'year'
                        ? e.target.value.replace(/\D/g, '')
                        : field.type === 'number'
                          ? e.target.value.replace(/\D/g, '').slice(0, 5)
                          : e.target.value,
                    )
                  }
                />
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          );
        })}
        <label>
          Visibility
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published (visible)</option>
            <option value="archived">Archived (hidden)</option>
          </select>
        </label>
        <label>
          Display order
          <input
            type="number"
            min="-10000"
            max="10000"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
          <small>Lower numbers appear first.</small>
        </label>
      </div>
      <div className="admin-content-preview">
        <small>PREVIEW · {status.toUpperCase()}</small>
        {(data.image || data.logo) && safeImage(data.image || data.logo) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image || data.logo} alt={name} />
        )}
        <h3>{data.title || name || 'Your title'}</h3>
        <p>
          {data.summary || data.quote || data.description || data.body || data.role || data.standard || '…'}
        </p>
        {spec.publicPath && slug && <small>Public page: {spec.publicPath(slug)}</small>}
      </div>
      {status === 'published' && issues.length > 0 && (
        <p className="admin-notice">To publish, please fill in: {issues.join(', ')}.</p>
      )}
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
      <div className="admin-form-footer">
        <span>Archived records stay saved but are hidden from the website.</span>
        <button disabled={busy} className="admin-button primary">
          {busy ? 'Saving…' : status === 'published' ? 'Save and publish' : 'Save ' + status}
        </button>
      </div>
    </form>
  );
}
