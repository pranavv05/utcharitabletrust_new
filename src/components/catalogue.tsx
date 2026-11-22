'use client';
import {useLiveChanges} from './live-updates';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {BookOpen, Search, Info, RotateCcw} from 'lucide-react';
type Book = {id: string; title: string; author: string; class_name: string; utbn: number};
export function Catalogue() {
  const [search, setSearch] = useState('');
  const [cls, setCls] = useState('');
  const [sort, setSort] = useState('utbn');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    books: Book[];
    total: number;
    classes?: string[];
    configured: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useLiveChanges('catalogue', () => setRetry((x) => x + 1));
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/books?${new URLSearchParams({search, class: cls, sort, page: String(page)})}`,
          {signal: controller.signal},
        );
        const body = await r.json();
        if (!r.ok) throw new Error(body.message);
        setData(body);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load books.');
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, cls, sort, page, retry]);
  return (
    <>
      {data && !data.configured && (
        <div className="notice">
          <Info size={18} />
          <span>
            The online catalogue is being connected to our library. For current availability, please{' '}
            <Link className="text-link" href="/contact?subject=Book%20Bank">
              contact our team
            </Link>
            .
          </span>
        </div>
      )}
      <div className="catalogue-filters">
        <label className="search-wrap">
          <Search size={18} />
          <input
            className="search-input"
            aria-label="Search books"
            placeholder="Search by title, author, or exact UTBN…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span className="sr-only">Filter by class</span>
          <select
            aria-label="Filter by class"
            value={cls}
            onChange={(e) => {
              setCls(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All classes</option>
            {data?.classes?.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="sr-only">Sort books</span>
          <select
            aria-label="Sort books"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="utbn">Sort by UTBN</option>
            <option value="title">Sort by title</option>
            <option value="author">Sort by author</option>
            <option value="class_name">Sort by class</option>
          </select>
        </label>
      </div>
      <div className="catalogue-meta">
        <span aria-live="polite">{busy ? 'Finding books…' : `${data?.total || 0} available books`}</span>
        <button
          className="text-link"
          style={{background: 'none', border: 0, cursor: 'pointer'}}
          onClick={() => {
            setSearch('');
            setCls('');
            setSort('utbn');
            setPage(1);
          }}
        >
          <RotateCcw size={12} style={{display: 'inline', marginRight: 6}} />
          Reset filters
        </button>
      </div>
      {error ? (
        <div className="empty-state" role="alert">
          <BookOpen />
          <h3>We couldn’t load the catalogue.</h3>
          <p>{error}</p>
          <button className="button" onClick={() => setRetry((x) => x + 1)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="table-wrap" aria-busy={busy}>
          <table>
            <thead>
              <tr>
                <th>UTBN</th>
                <th>Book title</th>
                <th>Author</th>
                <th>Class</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {data?.books.map((b) => (
                <tr key={b.id}>
                  <td>{String(b.utbn).padStart(4, '0')}</td>
                  <td>
                    <strong>{b.title}</strong>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.class_name}</td>
                  <td>
                    <span className="badge">Available</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.books.length && (
            <div className="empty-state">
              <BookOpen />
              <h3>
                {busy
                  ? 'Finding your next book…'
                  : search || cls
                    ? 'No matching books yet.'
                    : 'The next chapter is coming.'}
              </h3>
              <p>
                {search || cls
                  ? 'Try another title, author, or class.'
                  : 'Our available books will appear here once the library catalogue is connected.'}
              </p>
              {!busy && (
                <Link className="text-link" href="/contact?subject=Book%20Bank">
                  Ask our library team
                </Link>
              )}
            </div>
          )}
        </div>
      )}
      {Boolean(data && data.total > 25) && (
        <div className="pagination">
          <button
            className="button button-outline button-small"
            disabled={page <= 1 || busy}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.ceil((data?.total || 0) / 25)}
          </span>
          <button
            className="button button-outline button-small"
            disabled={busy || page * 25 >= (data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
