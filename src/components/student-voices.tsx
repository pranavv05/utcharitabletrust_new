'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import {VideoEmbed} from '@/components/video-embed';
import type {StudentVoice} from '@/lib/site-content';
import {GENERIC_STUDENT_NAME, yearsOf, byYear, type YearFilter as YearValue} from '@/lib/media';
import {YearFilter} from '@/components/year-filter';

/** Whole rows are shown, so the last row is never half empty; this many rows at first and per click. */
const ROWS = 3;

const hasName = (item: StudentVoice) => item.name.trim() !== GENERIC_STUDENT_NAME;

export function StudentVoiceCard({item}: {item: StudentVoice}) {
  return (
    <figure className="sx-quote sx-voice">
      <VideoEmbed
        url={item.videoUrl}
        file={item.videoFile}
        title={hasName(item) ? 'Video from ' + item.name : 'Student video'}
        poster={item.image}
      />
      {item.quote && (
        <blockquote>
          <p>{item.quote}</p>
        </blockquote>
      )}
      {(hasName(item) || item.role) && (
        <figcaption>
          <span>
            {hasName(item) && <strong>{item.name}</strong>}
            {item.role && <small>{item.role}</small>}
          </span>
        </figcaption>
      )}
    </figure>
  );
}

/** The Book Bank video wall: filter by year, six at a time so a long list stays fast. */
export function StudentVoiceGrid({voices}: {voices: StudentVoice[]}) {
  const [year, setYear] = useState<YearValue>('all');
  const [rows, setRows] = useState(ROWS);
  const [columns, setColumns] = useState(4);
  const grid = useRef<HTMLDivElement>(null);
  const years = useMemo(() => yearsOf(voices), [voices]);
  const filtered = byYear(voices, year);
  const shown = rows * columns;
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
        <div className="sx-quote-grid sx-voice-grid" ref={grid}>
          {filtered.slice(0, shown).map((v) => (
            <StudentVoiceCard key={v.id} item={v} />
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
    </>
  );
}

/**
 * Home page strip: every student video drifts from left to right on its own. It pauses when the visitor
 * points at it, tabs into it or starts a video, and stays still (scrollable by hand) for people who have
 * asked their device to reduce motion. The second copy of the list only makes the loop seamless.
 */
export function StudentVoiceMarquee({voices}: {voices: StudentVoice[]}) {
  const seconds = Math.max(40, voices.length * 7);
  return (
    <div className="sx-voice-marquee" aria-label="Student videos">
      <div className="sx-voice-track" style={{animationDuration: seconds + 's'}}>
        <div className="sx-voice-set">
          {voices.map((v) => (
            <StudentVoiceCard key={v.id} item={v} />
          ))}
        </div>
        <div className="sx-voice-set" aria-hidden="true" inert>
          {voices.map((v) => (
            <StudentVoiceCard key={v.id} item={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
