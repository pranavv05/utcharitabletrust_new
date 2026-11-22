'use client';
import Link from 'next/link';
import {useMemo, useState} from 'react';
import {TrustImage} from '@/components/ui/trust-image';
import {YearFilter} from '@/components/year-filter';
import {byYear, yearsOf, type YearFilter as YearValue} from '@/lib/media';
import type {GalleryPhoto} from '@/lib/photos';

const PAGE = 12;

/** "The work in pictures" for one programme, filterable by year, with a show-more button. */
export function ProgrammePhotos({photos}: {photos: GalleryPhoto[]}) {
  const [year, setYear] = useState<YearValue>('all');
  const [visible, setVisible] = useState(PAGE);
  const years = useMemo(() => yearsOf(photos), [photos]);
  const shown = byYear(photos, year);
  if (!photos.length) return null;
  return (
    <>
      <YearFilter
        years={years}
        value={year}
        hasUndated={photos.some((p) => !p.year)}
        onChange={(value) => {
          setYear(value);
          setVisible(PAGE);
        }}
        label="Filter photographs by year"
      />
      <div className="programme-picture-grid">
        {shown.slice(0, visible).map((photo) => (
          <Link
            key={photo.src}
            href={'/gallery?photo=' + encodeURIComponent(photo.src)}
            aria-label={'View ' + photo.caption + (photo.year ? ' (' + photo.year + ')' : '')}
          >
            <TrustImage
              src={photo.src}
              alt={photo.caption}
              loading="lazy"
              sizes="(max-width:600px) 90vw,30vw"
            />
          </Link>
        ))}
      </div>
      {!shown.length && <p className="gallery-empty">No photographs for this year yet.</p>}
      {shown.length > visible && (
        <div className="gallery-more">
          <p role="status">
            Showing {visible} of {shown.length} photographs
          </p>
          <button type="button" className="button" onClick={() => setVisible((v) => v + PAGE)}>
            Show more photographs
          </button>
        </div>
      )}
    </>
  );
}
