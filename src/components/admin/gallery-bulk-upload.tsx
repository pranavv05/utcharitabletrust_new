'use client';
import {useRef, useState} from 'react';
import {Dialog, send} from './workspace';
import {webSized} from '@/lib/admin/image-resize';
import {uploadImage} from '@/lib/admin/media-client';
import {captionFromFilename, isImageFile, photoSlug} from '@/lib/admin/photo-batch';

type Item = {
  id: number;
  file: File;
  caption: string;
  state: 'waiting' | 'working' | 'done' | 'failed';
  note: string;
};

const stateLabel = {waiting: 'Waiting', working: 'Uploading…', done: 'Published', failed: 'Failed'} as const;
const WORKERS = 3;

/**
 * Add many photographs to the gallery in one go. Each photo is shrunk to a web size in the browser,
 * uploaded, and published as a gallery item with a caption taken from its file name (editable afterwards).
 */
export function GalleryBulkUpload({
  categories,
  programmes,
  onClose,
  onDone,
}: {
  categories: string[];
  programmes: {name: string; path: string}[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [category, setCategory] = useState(categories[0] || 'Community');
  const [year, setYear] = useState('');
  const [link, setLink] = useState('');
  const [running, setRunning] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const stop = useRef(false);
  const next = useRef(1);

  function choose(files: FileList | null) {
    if (!files) return;
    const all = Array.from(files);
    const images = all
      .filter(isImageFile)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
    setSkipped(all.length - images.length);
    setItems(
      images.map((file) => ({
        id: next.current++,
        file,
        caption: captionFromFilename(file.name),
        state: 'waiting',
        note: '',
      })),
    );
  }
  const patch = (id: number, change: Partial<Item>) =>
    setItems((list) => list.map((item) => (item.id === id ? {...item, ...change} : item)));

  async function process(item: Item, order: number) {
    patch(item.id, {state: 'working', note: 'Preparing…'});
    try {
      const small = await webSized(item.file);
      patch(item.id, {note: 'Uploading…'});
      const url = await uploadImage(small);
      patch(item.id, {note: 'Saving…'});
      await send('content', {
        kind: 'gallery',
        name: item.caption.trim() || 'Photograph',
        slug: photoSlug(item.caption, crypto.randomUUID()),
        status: 'published',
        sort_order: 1000 + order,
        data: {
          image: url,
          category: category.trim() || 'Community',
          ...(year ? {year} : {}),
          ...(link ? {link} : {}),
        },
      });
      patch(item.id, {state: 'done', note: ''});
    } catch (error) {
      patch(item.id, {state: 'failed', note: (error as Error).message});
    }
  }

  async function start() {
    stop.current = false;
    setRunning(true);
    const queue = items.map((item, index) => ({item, index})).filter(({item}) => item.state !== 'done');
    let cursor = 0;
    async function worker() {
      while (!stop.current) {
        const entry = queue[cursor++];
        if (!entry) return;
        await process(entry.item, entry.index);
      }
    }
    await Promise.all(Array.from({length: WORKERS}, worker));
    setRunning(false);
    onDone();
  }

  const done = items.filter((i) => i.state === 'done').length;
  const failed = items.filter((i) => i.state === 'failed').length;
  const finished = items.length > 0 && done + failed === items.length;
  const yearOk = year === '' || /^\d{4}$/.test(year);
  return (
    <Dialog
      title="Bulk upload photographs"
      subtitle="Photos are shrunk to a web size and published straight away. You can edit captions afterwards."
      onClose={() => {
        if (!running) onClose();
      }}
      wide
    >
      <div className="admin-form">
        <div className="admin-form-grid">
          <label className="full">
            Photographs
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={running}
              onChange={(e) => choose(e.target.files)}
            />
            <small>
              Select as many as you like at once (hold Ctrl or Shift, or Ctrl+A in the folder). JPEG, PNG and
              WebP work everywhere; some phone formats such as HEIC may not.
            </small>
          </label>
          <label>
            Category for all
            <input
              list="bulk-categories"
              value={category}
              disabled={running}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="bulk-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Year for all (optional)
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="2024"
              value={year}
              disabled={running}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <label className="full">
            Related programme (optional)
            <select value={link} disabled={running} onChange={(e) => setLink(e.target.value)}>
              <option value="">None</option>
              {programmes.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {skipped > 0 && (
          <p className="admin-notice">{skipped} selected file(s) were not images and were skipped.</p>
        )}
        {items.length > 0 && (
          <>
            <div className="admin-bulk-bar">
              <span role="status">
                {done} of {items.length} published{failed ? ` · ${failed} failed` : ''}
              </span>
              <progress value={done + failed} max={items.length} aria-label="Upload progress" />
            </div>
            <div className="admin-table-scroll admin-bulk-list">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Photo</th>
                    <th>Caption</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.file.name}</td>
                      <td>
                        <input
                          aria-label={'Caption for ' + item.file.name}
                          value={item.caption}
                          maxLength={150}
                          disabled={running || item.state === 'done'}
                          onChange={(e) => patch(item.id, {caption: e.target.value})}
                        />
                      </td>
                      <td>
                        <span
                          className={
                            'admin-badge status-' +
                            (item.state === 'done' ? 'active' : item.state === 'failed' ? 'lost' : 'new')
                          }
                        >
                          {stateLabel[item.state]}
                        </span>
                        {item.note && <small> {item.note}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="admin-form-footer">
          <span>
            {finished
              ? failed
                ? 'Some photos failed. Fix the cause and press Retry; finished ones are not uploaded again.'
                : 'All photographs are published.'
              : 'Photos are not uploaded until you press Start.'}
          </span>
          {running ? (
            <button type="button" className="admin-button secondary" onClick={() => (stop.current = true)}>
              Stop after current photos
            </button>
          ) : finished && !failed ? (
            <button type="button" className="admin-button primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <button
              type="button"
              className="admin-button primary"
              disabled={!items.length || !yearOk}
              onClick={() => void start()}
            >
              {failed ? 'Retry failed' : `Start uploading ${items.length || ''} photographs`}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
