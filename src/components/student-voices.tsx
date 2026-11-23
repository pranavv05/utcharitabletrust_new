'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Play, X} from 'lucide-react';
import type {StudentVoice} from '@/lib/site-content';
import {GENERIC_STUDENT_NAME, byYear, videoEmbed, yearsOf, type YearFilter as YearValue} from '@/lib/media';
import {YearFilter} from '@/components/year-filter';

/** Whole rows are shown, so the last row is never half empty; this many rows at first and per click. */
const ROWS = 3;

const hasName = (item: StudentVoice) => item.name.trim() !== GENERIC_STUDENT_NAME;

/** A student video as a tall picture card. Pressing it opens the video large, in the viewer. */
function Tile({item, onOpen, bare}: {item: StudentVoice; onOpen: () => void; bare?: boolean}) {
  const quote = item.quote.length > 110 ? item.quote.slice(0, 107).trimEnd() + '…' : item.quote;
  return (
    <button
      type="button"
      className={'sx-voice-tile' + (bare ? ' bare' : '')}
      onClick={onOpen}
      aria-label={!bare && hasName(item) ? 'Watch the video from ' + item.name : 'Watch this student video'}
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt="" loading="lazy" />
      ) : (
        <span className="sx-voice-blank" aria-hidden="true" />
      )}
      <span className="sx-voice-shade" aria-hidden="true" />
      <span className="sx-voice-play" aria-hidden="true">
        <Play size={26} fill="currentColor" />
      </span>
      {!bare && (
        <span className="sx-voice-caption">
          {hasName(item) && <strong>{item.name}</strong>}
          {item.role && <small>{item.role}</small>}
          {quote ? <em>“{quote}”</em> : !hasName(item) && !item.role && <em>Watch their story</em>}
        </span>
      )}
    </button>
  );
}

/** The large viewer: the video as big as the screen allows, the words beside it, arrows to move on. */
function Viewer({
  voices,
  index,
  onIndex,
  onClose,
  bare,
}: {
  voices: StudentVoice[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  bare?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const item = voices[index];
  const embed = videoEmbed(item.videoUrl);
  const go = (step: number) => onIndex((index + step + voices.length) % voices.length);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={'sx-viewer' + (bare ? ' bare' : '')}
      aria-label={!bare && hasName(item) ? 'Video from ' + item.name : 'Student video'}
      data-lenis-prevent
      // React may close and reopen the dialog while mounting; only a real close should end the viewer.
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <button type="button" className="sx-viewer-close" onClick={onClose} aria-label="Close video">
        <X size={22} />
      </button>
      <div className="sx-viewer-stage">
        {item.videoFile ? (
          <video
            key={item.id}
            src={item.videoFile}
            poster={item.image || undefined}
            controls
            autoPlay
            playsInline
          />
        ) : embed ? (
          <iframe
            key={item.id}
            src={embed + (embed.includes('?') ? '&' : '?') + 'autoplay=1'}
            title={!bare && hasName(item) ? 'Video from ' + item.name : 'Student video'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
      {!bare && (
        <aside className="sx-viewer-info">
          <span className="chapter-tag">STUDENT VOICE</span>
          <h3>{hasName(item) ? item.name : 'A student’s story'}</h3>
          {(item.role || item.year) && (
            <p className="sx-viewer-meta">{[item.role, item.year].filter(Boolean).join(' · ')}</p>
          )}
          {item.quote && <blockquote>“{item.quote}”</blockquote>}
          {voices.length > 1 && (
            <nav className="sx-viewer-nav" aria-label="More student videos">
              <button type="button" onClick={() => go(-1)} aria-label="Previous video">
                <ChevronLeft size={22} />
              </button>
              <span>
                {index + 1} of {voices.length}
              </span>
              <button type="button" onClick={() => go(1)} aria-label="Next video">
                <ChevronRight size={22} />
              </button>
            </nav>
          )}
        </aside>
      )}
      {bare && voices.length > 1 && (
        <>
          <button
            type="button"
            className="sx-viewer-arrow prev"
            onClick={() => go(-1)}
            aria-label="Previous video"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="sx-viewer-arrow next"
            onClick={() => go(1)}
            aria-label="Next video"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}
    </dialog>
  );
}

/** Opens the viewer on a chosen video of a list. */
export function useStudentViewer(voices: StudentVoice[], bare = false) {
  const [open, setOpen] = useState<number | null>(null);
  const viewer =
    open !== null && voices[open] ? (
      <Viewer voices={voices} index={open} onIndex={setOpen} onClose={() => setOpen(null)} bare={bare} />
    ) : null;
  return {open, setOpen, viewer};
}

/** A plain row of cards, for when there are only a few videos. */
export function StudentVoiceRow({voices}: {voices: StudentVoice[]}) {
  const {setOpen, viewer} = useStudentViewer(voices, true);
  return (
    <>
      <div className="sx-voice-grid">
        {voices.map((v, i) => (
          <Tile key={v.id} item={v} onOpen={() => setOpen(i)} bare />
        ))}
      </div>
      {viewer}
    </>
  );
}

/** The Book Bank video wall: filter by year, three full rows at a time so a long list stays fast. */
export function StudentVoiceGrid({voices}: {voices: StudentVoice[]}) {
  const [year, setYear] = useState<YearValue>('all');
  const [rows, setRows] = useState(ROWS);
  const [columns, setColumns] = useState(4);
  const grid = useRef<HTMLDivElement>(null);
  const years = useMemo(() => yearsOf(voices), [voices]);
  const filtered = byYear(voices, year);
  const shown = rows * columns;
  const {setOpen, viewer} = useStudentViewer(filtered);
  // The grid fits as many columns as the screen allows, so count them to show complete rows.
  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      const count = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
      if (count > 0) setColumns(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [filtered.length]);
  return (
    <>
      {years.length > 1 && (
        <div className="sx-voice-filters">
          <YearFilter
            years={years}
            value={year}
            label="Filter by year"
            onChange={(value) => {
              setYear(value);
              setRows(ROWS);
            }}
          />
        </div>
      )}
      {filtered.length ? (
        <div className="sx-voice-grid" ref={grid}>
          {filtered.slice(0, shown).map((v, i) => (
            <Tile key={v.id} item={v} onOpen={() => setOpen(i)} />
          ))}
        </div>
      ) : (
        <p className="gallery-empty">No videos match this filter.</p>
      )}
      {filtered.length > shown && (
        <div className="sx-voice-more">
          <button type="button" className="button button-outline" onClick={() => setRows((n) => n + ROWS)}>
            Show more videos ({filtered.length - shown} more)
          </button>
        </div>
      )}
      {viewer}
    </>
  );
}

/**
 * Home page strip: every student video drifts from left to right on its own. It pauses when the visitor
 * points at it, tabs into it or opens a video, and stays still (scrollable by hand) for people who have
 * asked their device to reduce motion. The second copy of the list only makes the loop seamless.
 */
export function StudentVoiceMarquee({voices}: {voices: StudentVoice[]}) {
  const seconds = Math.max(40, voices.length * 7);
  const {open, setOpen, viewer} = useStudentViewer(voices, true);
  return (
    <>
      <div className="sx-voice-marquee" aria-label="Student videos">
        <div
          className={'sx-voice-track' + (open !== null ? ' paused' : '')}
          style={{animationDuration: seconds + 's'}}
        >
          <div className="sx-voice-set">
            {voices.map((v, i) => (
              <Tile key={v.id} item={v} onOpen={() => setOpen(i)} bare />
            ))}
          </div>
          <div className="sx-voice-set" aria-hidden="true" inert>
            {voices.map((v) => (
              <Tile key={v.id} item={v} onOpen={() => {}} bare />
            ))}
          </div>
        </div>
      </div>
      {viewer}
    </>
  );
}
