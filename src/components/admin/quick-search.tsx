'use client';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';
import {Search, X} from 'lucide-react';
import {quickResults, searchable, type QuickResult} from '@/lib/admin/quick-search';

const sources = ['books', 'people', 'loans'] as const;

/** Find a book, person or issued book from anywhere. Opens with Ctrl/Cmd+K or "/". */
export function QuickSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuickResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
    input.current?.focus();
  }, []);
  const close = useCallback(() => {
    dialog.current?.close();
    setQuery('');
    setResults([]);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!searchable(query)) {
      setResults([]);
      setBusy(false);
      setFailed(false);
      return;
    }
    const abort = new AbortController();
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const lists = await Promise.all(
          sources.map(async (entity) => {
            const r = await fetch(`/api/admin/${entity}?search=${encodeURIComponent(query.trim())}`, {
              signal: abort.signal,
            });
            if (!r.ok) throw Error('Search failed');
            return quickResults(entity, (await r.json()).rows ?? []);
          }),
        );
        setResults(lists.flat());
        setFailed(false);
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query]);

  const groups = ['Books', 'People', 'Issued books'] as const;
  return (
    <>
      <button
        type="button"
        className="admin-search-trigger"
        onClick={open}
        aria-label="Search books, people and issued books"
      >
        <Search size={16} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="admin-search-dialog"
        aria-label="Search the workspace"
        onClose={() => {
          setQuery('');
          setResults([]);
        }}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="admin-search-box">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) {
                window.location.assign(results[0].href);
              }
            }}
            placeholder="Search a book, UTBN, person, phone or issue reference"
            aria-label="Search"
            autoComplete="off"
            maxLength={150}
          />
          <button type="button" onClick={close} aria-label="Close search">
            <X size={18} />
          </button>
        </div>
        <div className="admin-search-results" aria-live="polite">
          {!searchable(query) && <p className="admin-empty-inline">Type at least two characters.</p>}
          {searchable(query) && busy && !results.length && <p className="admin-empty-inline">Searching…</p>}
          {failed && <p className="admin-empty-inline">Search is unavailable. Please try again.</p>}
          {searchable(query) && !busy && !failed && !results.length && (
            <p className="admin-empty-inline">No matches for “{query.trim()}”.</p>
          )}
          {groups.map((group) => {
            const items = results.filter((r) => r.group === group);
            return items.length ? (
              <div key={group}>
                <h3>{group}</h3>
                {items.map((r) => (
                  <Link key={r.key} href={r.href} onClick={close}>
                    <strong>{r.title}</strong>
                    <small>{r.detail}</small>
                  </Link>
                ))}
              </div>
            ) : null;
          })}
        </div>
      </dialog>
    </>
  );
}
