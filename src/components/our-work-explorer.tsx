'use client';
import {useMemo, useState} from 'react';
import {ProgrammeGrid} from '@/components/programme-grid';
import {YearFilter} from '@/components/year-filter';
import {photosForProgramme} from '@/lib/photos';
import {yearsOf, type YearFilter as YearValue} from '@/lib/media';
import type {SiteContent} from '@/lib/site-content';

/** Programme cards with a year filter. A programme matches a year when it has photographs from that year. */
export function OurWorkExplorer({
  programmes,
  gallery,
}: {
  programmes: SiteContent['programmes'];
  gallery: SiteContent['gallery'];
}) {
  const [year, setYear] = useState<YearValue>('all');
  const [sort, setSort] = useState('featured');
  const years = useMemo(
    () => yearsOf(programmes.flatMap((p) => photosForProgramme(gallery, p.slug))),
    [programmes, gallery],
  );
  const shown = useMemo(() => {
    const list =
      year === 'all' || year === 'undated'
        ? programmes
        : programmes.filter((p) => photosForProgramme(gallery, p.slug).some((photo) => photo.year === year));
    return sort === 'name' ? list.toSorted((a, b) => a.name.localeCompare(b.name)) : list;
  }, [programmes, gallery, year, sort]);
  return (
    <>
      {years.length > 0 && (
        <div className="gallery-toolbar photo-gallery-toolbar sx-toolbar">
          <YearFilter years={years} value={year} onChange={setYear} label="Filter programmes by year" />
          <label className="gallery-sort">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Featured order</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      )}
      <ProgrammeGrid programmes={shown} gallery={gallery} />
      {!shown.length && <p className="gallery-empty">No programme activity was recorded for this year.</p>}
    </>
  );
}
