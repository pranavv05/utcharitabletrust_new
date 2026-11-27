'use client';
import {useEffect, useRef, useState} from 'react';
import {Check, CircleAlert, Film, LoaderCircle, Play, Upload} from 'lucide-react';
import {Dialog, send} from './workspace';
import {uploadImage, uploadLarge} from '@/lib/admin/media-client';
import {photoSlug} from '@/lib/admin/photo-batch';
import {GENERIC_STUDENT_NAME} from '@/lib/media';
import {videoPoster} from '@/lib/admin/video-poster';

type Item = {
  id: number;
  file: File;
  state: 'waiting' | 'working' | 'done' | 'failed';
  note: string;
};

const WORKERS = 2;
const isVideoFile = (file: File) => /\.(mp4|webm)$/i.test(file.name) || /^video\/(mp4|webm)$/.test(file.type);
const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

/** One video in the list, with a name box and a preview that plays the local file. */
function Row({item, index}: {item: Item; index: number}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return (
    <li className={'admin-video-row ' + item.state}>
      <span className="admin-video-index">{index + 1}</span>
      <button
        type="button"
        className="admin-video-peek"
        aria-label={(url ? 'Hide preview of ' : 'Preview ') + item.file.name}
        onClick={() => setUrl(url ? '' : URL.createObjectURL(item.file))}
      >
        <Play size={16} fill="currentColor" />
      </button>
      <div className="admin-video-file">
        <strong title={item.file.name}>{item.file.name}</strong>
        <small>{megabytes(item.file.size)}</small>
      </div>
      <span className={'admin-video-state ' + item.state} role="status">
        {item.state === 'done' && <Check size={15} />}
        {item.state === 'failed' && <CircleAlert size={15} />}
        {item.state === 'working' && <LoaderCircle size={15} className="admin-spin" />}
        {item.state === 'waiting' && 'Ready'}
        {item.state === 'working' && (item.note || 'Uploading…')}
        {item.state === 'done' && 'Published'}
        {item.state === 'failed' && 'Failed'}
      </span>
      {item.state === 'failed' && item.note && <p className="admin-video-error">{item.note}</p>}
      {url && <video src={url} controls autoPlay playsInline className="admin-video-player" />}
    </li>
  );
}

/**
 * Add many student videos at once. Each video file is uploaded to storage, a preview picture is made from
 * one of its frames, and the video is published on the Book Bank page. Names, quotes and years can be
 * added, and any video removed, afterwards.
 */
export function StudentVideoBulkUpload({onClose, onDone}: {onClose: () => void; onDone: () => void}) {
  const [items, setItems] = useState<Item[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [running, setRunning] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const stop = useRef(false);
  const next = useRef(1);

  function choose(files: FileList | null) {
    if (!files) return;
    const all = Array.from(files);
    const videos = all
      .filter(isVideoFile)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
    setSkipped(all.length - videos.length);
    setItems(videos.map((file) => ({id: next.current++, file, state: 'waiting', note: ''})));
  }
  const patch = (id: number, change: Partial<Item>) =>
    setItems((list) => list.map((item) => (item.id === id ? {...item, ...change} : item)));

  async function process(item: Item, order: number) {
    patch(item.id, {state: 'working', note: 'Uploading video…'});
    try {
      const videoUrl = await uploadLarge(item.file, (fraction) =>
        patch(item.id, {note: `Shrinking video… ${Math.round(fraction * 100)}%`}),
      );
      patch(item.id, {note: 'Making preview…'});
      const poster = await videoPoster(item.file);
      const image = poster ? await uploadImage(poster).catch(() => '') : '';
      patch(item.id, {note: 'Saving…'});
      await send('content', {
        kind: 'student_voice',
        name: GENERIC_STUDENT_NAME,
        slug: photoSlug('student-video', crypto.randomUUID()),
        status: 'published',
        sort_order: 1000 + order,
        data: {
          video_file: videoUrl,
          ...(image ? {image} : {}),
          ...(year ? {year} : {}),
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
  const total = items.reduce((sum, i) => sum + i.file.size, 0);
  return (
    <Dialog
      title="Add student videos"
      subtitle="Choose the video files. They are published on the Book Bank page as soon as they finish uploading."
      onClose={() => {
        if (!running) onClose();
      }}
      wide
    >
      <div className="admin-video-batch">
        <label className={'admin-dropzone' + (items.length ? ' compact' : '')}>
          <input
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm"
            multiple
            disabled={running}
            onChange={(e) => choose(e.target.files)}
          />
          <span className="admin-dropzone-icon">
            {items.length ? <Film size={20} /> : <Upload size={26} />}
          </span>
          <strong>{items.length ? 'Choose different videos' : 'Choose video files'}</strong>
          <small>
            MP4 or WebM. Videos over 50 MB are shrunk automatically (keep this screen open). Select many at
            once with Ctrl+A in the folder.
          </small>
        </label>
        {skipped > 0 && (
          <p className="admin-notice">
            {skipped} selected file(s) were not MP4 or WebM videos and were skipped.
          </p>
        )}
        {items.length > 0 && (
          <>
            <div className="admin-video-summary">
              <span>
                <strong>{items.length}</strong> videos · {megabytes(total)}
              </span>
              <label>
                Year recorded
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={year}
                  disabled={running}
                  aria-label="Year recorded"
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
                />
              </label>
            </div>
            {(running || done > 0 || failed > 0) && (
              <div className="admin-bulk-bar">
                <span role="status">
                  {done} of {items.length} published{failed ? ` · ${failed} failed` : ''}
                </span>
                <progress value={done + failed} max={items.length} aria-label="Upload progress" />
              </div>
            )}
            <ul className="admin-video-list">
              {items.map((item, index) => (
                <Row key={item.id} item={item} index={index} />
              ))}
            </ul>
          </>
        )}
        <div className="admin-form-footer">
          <span>
            {finished
              ? failed
                ? 'Some videos failed. Press Retry; finished ones are not uploaded again.'
                : 'All videos are published.'
              : items.length
                ? 'Nothing is uploaded until you press Start.'
                : ''}
          </span>
          {running ? (
            <button type="button" className="admin-button secondary" onClick={() => (stop.current = true)}>
              Stop after current videos
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
              {failed ? 'Retry failed' : `Start uploading ${items.length || ''} videos`}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
