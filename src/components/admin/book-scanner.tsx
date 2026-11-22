'use client';
import {useEffect, useRef, useState} from 'react';
import {Camera, ImageIcon, X, Check} from 'lucide-react';
import {LookupInput} from './lookup-input';
import {readBarcodeIsbn, photoToDataUrl} from '@/lib/admin/barcode';
import {normalizeIsbn} from '@/lib/admin/isbn';

export type ScannedBook = {title: string; author: string; class_name: string};
type Draft = ScannedBook & {source: 'barcode' | 'cover' | 'manual'; isbn?: string; categories?: string[]};

async function scanRequest(body: unknown) {
  const response = await fetch('/api/admin/book-scan', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return {ok: response.ok, status: response.status, data};
}

/**
 * Take a photo of a book to fill in its details. The ISBN barcode is tried first (free, exact);
 * if there is no readable barcode the cover is read by AI. Staff always review before adding.
 */
export function BookScanner({onAdd, onClose}: {onAdd: (book: ScannedBook) => void; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isbnText, setIsbnText] = useState('');
  const [added, setAdded] = useState(0);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    setError('');
    setDraft(null);
    setBusy(true);
    try {
      setStatus('Looking for a barcode…');
      const isbn = await readBarcodeIsbn(file);
      if (isbn) {
        setStatus('Barcode found. Looking up the book…');
        const found = await scanRequest({isbn});
        if (found.ok) {
          setDraft({...found.data.book, categories: found.data.book.categories});
          return;
        }
      }
      setStatus('Reading the cover…');
      const read = await scanRequest({image: await photoToDataUrl(file)});
      if (read.ok) {
        setDraft(read.data.book);
        return;
      }
      setError(read.data.message || 'Could not read that photo.');
      setDraft({title: '', author: '', class_name: '', source: 'manual', ...(isbn ? {isbn} : {})});
    } catch {
      setError('Could not process that photo. Try again or type the details.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  async function fromIsbn(e: React.FormEvent) {
    e.preventDefault();
    const isbn = normalizeIsbn(isbnText);
    if (!isbn) {
      setError('That is not a valid ISBN. Check the digits.');
      return;
    }
    setError('');
    setBusy(true);
    setStatus('Looking up the book…');
    try {
      const found = await scanRequest({isbn});
      if (found.ok) setDraft(found.data.book);
      else {
        setError(found.data.message || 'No book found.');
        setDraft({title: '', author: '', class_name: '', source: 'manual', isbn});
      }
    } catch {
      setError('Lookup failed. Please try again.');
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  function add() {
    if (!draft || !draft.title.trim()) return;
    onAdd({title: draft.title.trim(), author: draft.author.trim(), class_name: draft.class_name.trim()});
    setAdded((n) => n + 1);
    setDraft(null);
    setError('');
    setIsbnText('');
  }

  return (
    <dialog ref={dialog} className="admin-scanner" aria-label="Scan a book" onClose={onClose}>
      <div className="admin-scanner-head">
        <h3>Scan a book</h3>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close scanner">
          <X size={20} />
        </button>
      </div>
      <p className="admin-form-help">
        Take a clear photo of the barcode on the back cover, or of the front cover. The details fill in
        automatically; check them before adding.
      </p>
      <div className="admin-scanner-actions">
        <label className="admin-button primary">
          <Camera size={18} /> Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              void fromPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <label className="admin-button secondary">
          <ImageIcon size={18} /> Choose a photo
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              void fromPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <form className="admin-scanner-isbn" onSubmit={fromIsbn}>
        <label>
          Or type the ISBN
          <input
            value={isbnText}
            onChange={(e) => setIsbnText(e.target.value)}
            inputMode="numeric"
            placeholder="978…"
            maxLength={20}
          />
        </label>
        <button className="admin-button secondary" disabled={busy || !isbnText.trim()}>
          Look up
        </button>
      </form>
      {status && (
        <p role="status" className="admin-scanner-status">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="admin-notice error">
          {error}
        </p>
      )}
      {draft && (
        <div className="admin-scanner-result">
          <p className="admin-form-help">
            {draft.source === 'barcode'
              ? 'Found by barcode.'
              : draft.source === 'cover'
                ? 'Read from the cover. Please check the spelling.'
                : 'Type the details below.'}
            {draft.isbn ? ` ISBN ${draft.isbn}.` : ''}
          </p>
          <label>
            Book title
            <input
              required
              value={draft.title}
              maxLength={250}
              onChange={(e) => setDraft({...draft, title: e.target.value})}
            />
          </label>
          <label>
            Author
            <LookupInput
              entity="authors"
              value={draft.author}
              onChange={(v) => setDraft({...draft, author: v})}
            />
          </label>
          <label>
            Class / category
            <LookupInput
              entity="classes"
              value={draft.class_name}
              onChange={(v) => setDraft({...draft, class_name: v})}
            />
          </label>
          {!!draft.categories?.length && !draft.class_name && (
            <p className="admin-form-help">
              Suggested subjects:{' '}
              {draft.categories.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="admin-chip"
                  onClick={() => setDraft({...draft, class_name: c})}
                >
                  {c}
                </button>
              ))}
            </p>
          )}
          <button
            type="button"
            className="admin-button primary"
            disabled={!draft.title.trim() || !draft.author.trim() || !draft.class_name.trim()}
            onClick={add}
          >
            <Check size={17} /> Add to donation list
          </button>
          {(!draft.author.trim() || !draft.class_name.trim()) && (
            <p className="admin-form-help">Author and class are required for every copy.</p>
          )}
        </div>
      )}
      <div className="admin-scanner-foot">
        <span>{added ? `${added} added to the list` : 'Nothing added yet'}</span>
        <button type="button" className="admin-button secondary" onClick={() => dialog.current?.close()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
