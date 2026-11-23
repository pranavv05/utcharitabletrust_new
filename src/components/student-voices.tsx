'use client';
import {useMemo, useState} from 'react';
import {VideoEmbed} from '@/components/video-embed';
import type {StudentVoice} from '@/lib/site-content';
import {GENERIC_STUDENT_NAME, yearsOf, byYear, type YearFilter as YearValue} from '@/lib/media';
import {YearFilter} from '@/components/year-filter';

const PAGE = 6;

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
  const [shown, setShown] = useState(PAGE);
  const years = useMemo(() => yearsOf(voices), [voices]);
  const filtered = byYear(voices, year);
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
              setShown(PAGE);
            }}
          />
        </div>
      )}
      {filtered.length ? (
        <div className="sx-quote-grid sx-voice-grid">
          {filtered.slice(0, shown).map((v) => (
            <StudentVoiceCard key={v.id} item={v} />
          ))}
        </div>
      ) : (
        <p className="gallery-empty">No videos match this filter.</p>
      )}
      {filtered.length > shown && (
        <div className="sx-voice-more">
          <button type="button" className="button button-outline" onClick={() => setShown((n) => n + PAGE)}>
            Show more videos ({filtered.length - shown} more)
          </button>
        </div>
      )}
    </>
  );
}
