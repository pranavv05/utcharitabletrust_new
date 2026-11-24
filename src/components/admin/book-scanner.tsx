'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera, Check, ImageIcon, Lightbulb, ScanLine, X} from 'lucide-react';
import {LookupInput} from './lookup-input';
import {nativeDetector, photoToDataUrl, readBarcode, readFrame} from '@/lib/admin/barcode';
import {
  cameraEnvironment,
  canUseTorch,
  describeCameraError,
  openCamera,
  setTorch,
  stopCamera,
} from '@/lib/admin/camera';
import {normalizeIsbn, toIsbn13} from '@/lib/admin/isbn';

export type ScannedBook = {title: string; author: string; class_name: string};
type Draft = ScannedBook & {
  source: 'barcode' | 'cover' | 'manual' | 'catalogue';
  isbn?: string;
  categories?: string[];
};

async function scanRequest(body: unknown) {
  try {
    const response = await fetch('/api/admin/book-scan', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return {ok: response.ok, status: response.status, data};
  } catch {
    return {
      ok: false,
      status: 0,
      data: {message: 'Could not reach the server. Check the internet connection and try again.'},
    };
  }
}

/** The most a phone photo may weigh, so a huge file never freezes the page. */
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;

/**
 * Scan a book to fill in its details. The camera watches for the ISBN barcode on the back cover and reads it by
 * itself; a photo of the barcode or cover, or the typed ISBN, work when the live camera cannot be used. Books the
 * trust has entered before fill in instantly, including the class. Staff always check before adding.
 */
export function BookScanner({onAdd, onClose}: {onAdd: (book: ScannedBook) => void; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const loop = useRef<{stop: () => void} | null>(null);
  const alive = useRef(true);
  const attempt = useRef(0);
  const looking = useRef(false);
  const [camera, setCamera] = useState<'off' | 'starting' | 'live'>('off');
  const [cameraNote, setCameraNote] = useState('');
  const [torch, setTorchOn] = useState<boolean | null>(null);
  const [hint, setHint] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isbnText, setIsbnText] = useState('');
  const [added, setAdded] = useState(0);
  const [photoReading, setPhotoReading] = useState<boolean | null>(null);

  const stopLoop = useCallback(() => {
    loop.current?.stop();
    loop.current = null;
  }, []);
  const stopEverything = useCallback(() => {
    stopLoop();
    stopCamera(stream.current);
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, [stopLoop]);

  // Show the barcode details for an ISBN (from the camera, a photo or typing).
  const lookUp = useCallback(async (isbn: string): Promise<boolean> => {
    if (looking.current) return false;
    looking.current = true;
    setError('');
    setHint('');
    setBusy(true);
    setStatus(`Barcode found (ISBN ${isbn}). Looking up the book…`);
    try {
      const found = await scanRequest({isbn});
      if (!alive.current) return false;
      if (found.ok) {
        setDraft(found.data.book);
        return true;
      }
      setError(found.data.message || 'No book found for that ISBN.');
      setDraft({title: '', author: '', class_name: '', source: 'manual', isbn: toIsbn13(isbn) || isbn});
      return false;
    } finally {
      looking.current = false;
      if (alive.current) {
        setBusy(false);
        setStatus('');
      }
    }
  }, []);

  // Watch the camera picture for a barcode, a few times a second, until a book's ISBN is read.
  const startLoop = useCallback(() => {
    stopLoop();
    const element = video.current;
    if (!element) return;
    const canvas = document.createElement('canvas');
    const detector = nativeDetector();
    let running = true;
    let frame = 0;
    let working = false;
    let otherSeen = 0;
    const tick = async () => {
      if (!running) return;
      if (!working && !document.hidden && element.readyState >= 2 && element.videoWidth > 0) {
        working = true;
        try {
          const scale = Math.min(1, 1280 / element.videoWidth);
          canvas.width = Math.round(element.videoWidth * scale);
          canvas.height = Math.round(element.videoHeight * scale);
          canvas
            .getContext('2d', {willReadFrequently: true})!
            .drawImage(element, 0, 0, canvas.width, canvas.height);
          const read = await readFrame(canvas, frame++, detector);
          if (!running) return;
          if (read.isbn) {
            running = false;
            navigator.vibrate?.(60);
            element.pause();
            const ok = await lookUp(read.isbn);
            if (!ok && alive.current) setHint('');
            return;
          }
          if (read.other) {
            otherSeen++;
            if (otherSeen >= 3)
              setHint(
                'That is a shop (price) barcode, not the book’s ISBN. Look for the barcode printed above “ISBN”, starting with 978.',
              );
          } else if (otherSeen) otherSeen = 0;
        } catch {
          // a bad frame is simply skipped
        } finally {
          working = false;
        }
      }
      if (running) timer = setTimeout(tick, 110);
    };
    let timer = setTimeout(tick, 300);
    loop.current = {
      stop: () => {
        running = false;
        clearTimeout(timer);
      },
    };
  }, [lookUp, stopLoop]);

  const startCamera = useCallback(async () => {
    setCameraNote('');
    setError('');
    setCamera('starting');
    stopEverything();
    // Only the most recent start may change anything: an older one that finishes late must not undo it.
    const mine = ++attempt.current;
    const current = () => alive.current && attempt.current === mine;
    try {
      const media = await openCamera();
      if (!current()) {
        stopCamera(media);
        return;
      }
      stream.current = media;
      const track = media.getVideoTracks()[0];
      track?.addEventListener('ended', () => {
        if (alive.current && stream.current === media) {
          stopEverything();
          setCamera('off');
          setCameraNote('The camera stopped. Press “Start camera” to use it again.');
        }
      });
      const element = video.current!;
      element.srcObject = media;
      await element.play();
      if (!current()) return;
      setTorchOn(canUseTorch(track) ? false : null);
      setCamera('live');
      setHint('');
      startLoop();
    } catch (e) {
      if (!current()) return;
      stopEverything();
      setCamera('off');
      setCameraNote(describeCameraError(e).message);
    }
  }, [startLoop, stopEverything]);

  // Open the dialog and the camera straight away; always switch the camera off again when leaving.
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    const env = cameraEnvironment();
    if (env.secure && env.hasApi) void startCamera();
    else setCameraNote(describeCameraError(null, env).message);
    fetch('/api/admin/book-scan')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive.current && setPhotoReading(d ? Boolean(d.photoReading) : null))
      .catch(() => {});
    const onVisible = () => {
      if (document.hidden) stopLoop();
      else if (stream.current && video.current && !video.current.paused) startLoop();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Back to watching for the next book. */
  function scanNext() {
    setDraft(null);
    setError('');
    setStatus('');
    setHint('');
    setIsbnText('');
    if (stream.current && video.current) {
      void video.current.play().catch(() => {});
      startLoop();
    } else if (cameraEnvironment().hasApi) void startCamera();
  }

  async function fromPhoto(file: File | undefined) {
    if (!file) return;
    setError('');
    setHint('');
    setDraft(null);
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name)) {
      setError('That file is not a photo. Choose a picture of the barcode or the cover.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('That photo is too large (over 30 MB). Take it again at a lower quality.');
      return;
    }
    stopLoop();
    video.current?.pause();
    setBusy(true);
    try {
      setStatus('Looking for a barcode…');
      const read = await readBarcode(file);
      if (!alive.current) return;
      if (read.isbn) {
        await lookUp(read.isbn);
        return;
      }
      // No ISBN barcode in the picture: read the cover instead, when that is set up.
      if (photoReading !== false) {
        setStatus('No barcode found. Reading the cover…');
        const cover = await scanRequest({image: await photoToDataUrl(file)});
        if (!alive.current) return;
        if (cover.ok) {
          setDraft(cover.data.book);
          return;
        }
        setError(
          cover.status === 503 || cover.status === 0
            ? cover.data.message
            : cover.data.message || 'Could not read that photo.',
        );
      } else
        setError(
          read.other
            ? 'That is a shop (price) barcode, not the book’s ISBN. Photograph the barcode printed above “ISBN” (it starts with 978), or type the details.'
            : 'No barcode found in that photo. Move closer so the barcode fills most of the picture, hold the phone steady, or type the ISBN or the details.',
        );
      setDraft({title: '', author: '', class_name: '', source: 'manual'});
    } catch (e) {
      setError((e as Error).message || 'Could not process that photo. Try again or type the details.');
    } finally {
      if (alive.current) {
        setBusy(false);
        setStatus('');
      }
    }
  }

  async function fromIsbn() {
    const isbn = normalizeIsbn(isbnText);
    if (!isbn) {
      setError('That is not a valid ISBN. Check the digits (10 or 13 numbers).');
      return;
    }
    stopLoop();
    video.current?.pause();
    await lookUp(isbn);
  }

  function add() {
    if (!draft || !draft.title.trim() || !draft.author.trim() || !draft.class_name.trim()) return;
    const book = {
      title: draft.title.trim(),
      author: draft.author.trim(),
      class_name: draft.class_name.trim(),
    };
    onAdd(book);
    // Remember it, so the next copy of this book fills in by itself (title, author and class).
    const isbn = draft.isbn ? toIsbn13(draft.isbn) : null;
    if (isbn) void scanRequest({remember: {isbn, ...book}});
    setAdded((n) => n + 1);
    scanNext();
  }

  // Rendered outside the donation form so Enter and buttons here can never submit that form.
  const view = (
    <dialog
      ref={dialog}
      className="admin-scanner"
      aria-label="Scan a book"
      onClose={() => {
        alive.current = false;
        stopEverything();
        onClose();
      }}
    >
      <div className="admin-scanner-head">
        <h3>Scan a book</h3>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close scanner">
          <X size={20} />
        </button>
      </div>
      <div className={'admin-scanner-camera' + (camera === 'live' ? ' live' : '')}>
        <video ref={video} playsInline muted autoPlay aria-label="Camera view" />
        {camera === 'live' && !draft && (
          <>
            <span className="admin-scanner-frame" aria-hidden="true" />
            <span className="admin-scanner-hint">
              <ScanLine size={15} aria-hidden="true" /> Hold the back cover so the barcode fits the frame
            </span>
          </>
        )}
        {camera !== 'live' && (
          <div className="admin-scanner-off">
            <Camera size={28} aria-hidden="true" />
            <p>{camera === 'starting' ? 'Starting the camera…' : cameraNote || 'The camera is off.'}</p>
            {camera === 'off' && cameraEnvironment().hasApi && cameraEnvironment().secure && (
              <button type="button" className="admin-button primary" onClick={() => void startCamera()}>
                Start camera
              </button>
            )}
          </div>
        )}
      </div>
      {camera === 'live' && (
        <div className="admin-scanner-controls">
          {torch !== null && (
            <button
              type="button"
              className="admin-button secondary"
              aria-pressed={torch}
              onClick={async () => {
                try {
                  await setTorch(stream.current?.getVideoTracks()[0], !torch);
                  setTorchOn(!torch);
                } catch {
                  setTorchOn(null);
                }
              }}
            >
              <Lightbulb size={16} /> {torch ? 'Light off' : 'Light on'}
            </button>
          )}
          <button
            type="button"
            className="admin-button secondary"
            onClick={() => {
              stopEverything();
              setCamera('off');
              setCameraNote('The camera is off.');
            }}
          >
            Stop camera
          </button>
        </div>
      )}
      {hint && <p className="admin-scanner-status">{hint}</p>}
      <p className="admin-form-help">
        The camera reads the barcode by itself. If it cannot, take a clear photo of the barcode on the back
        cover (or of the front cover), or type the ISBN.
      </p>
      <div className="admin-scanner-actions">
        <label className="admin-button secondary">
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
      <div className="admin-scanner-isbn">
        <label>
          Or type the ISBN
          <input
            value={isbnText}
            onChange={(e) => setIsbnText(e.target.value)}
            inputMode="numeric"
            placeholder="978…"
            maxLength={24}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy && isbnText.trim()) void fromIsbn();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="admin-button secondary"
          disabled={busy || !isbnText.trim()}
          onClick={() => void fromIsbn()}
        >
          Look up
        </button>
      </div>
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
            {draft.source === 'catalogue'
              ? 'Already in our records, so the title, author and class are filled in.'
              : draft.source === 'barcode'
                ? 'Found by barcode. Please add the class.'
                : draft.source === 'cover'
                  ? 'Read from the cover. Please check the spelling.'
                  : 'Type the details below. They will be remembered for the next copy of this book.'}
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
          <div className="admin-scanner-result-actions">
            <button
              type="button"
              className="admin-button primary"
              disabled={!draft.title.trim() || !draft.author.trim() || !draft.class_name.trim()}
              onClick={add}
            >
              <Check size={17} /> Add to donation list
            </button>
            <button type="button" className="admin-button secondary" onClick={scanNext}>
              Not this book
            </button>
          </div>
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
  // Inside the admin area, so the dialog gets the admin colours (and light/dark theme), not the page's defaults.
  return createPortal(view, document.querySelector('.admin-app') || document.body);
}
