'use client';
import Link from 'next/link';
import {TrustImage} from '@/components/ui/trust-image';
import {useState, useEffect, useRef} from 'react';
import {X, ChevronLeft, ChevronRight} from 'lucide-react';
import type {SiteContent} from '@/lib/site-content';
import {gsap, useGSAP} from '@/lib/motion';
import {YearFilter} from '@/components/year-filter';
import {byYear, yearsOf, type YearFilter as YearValue} from '@/lib/media';
const PAGE_SIZE = 24;
export function Gallery({gallery}: {gallery: SiteContent['gallery']}) {
  const [category, setCategory] = useState('All photos');
  const [sort, setSort] = useState('featured');
  const [year, setYear] = useState<YearValue>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [loadedPhoto, setLoadedPhoto] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const scope = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const years = yearsOf(gallery);
  const filtered = byYear(gallery, year)
    .filter((g) => category === 'All photos' || g.category === category)
    .toSorted((a, b) =>
      sort === 'title'
        ? a.caption.localeCompare(b.caption)
        : sort === 'title-desc'
          ? b.caption.localeCompare(a.caption)
          : sort === 'year-new'
            ? (b.year || '').localeCompare(a.year || '')
            : sort === 'year-old'
              ? (a.year || '9999').localeCompare(b.year || '9999')
              : sort === 'category'
                ? a.category.localeCompare(b.category) || a.caption.localeCompare(b.caption)
                : 0,
    );
  const index = filtered.findIndex((g) => g.src === selected);
  const current = index < 0 ? null : filtered[index];
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '.photo-only-gallery .gallery-card',
          {opacity: 0, y: 18},
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: {each: 0.025, amount: 0.6},
            ease: 'power3.out',
            clearProps: 'opacity,transform',
          },
        );
      });
      return () => mm.revert();
    },
    {scope, dependencies: [category, sort, year, gallery], revertOnUpdate: true},
  );
  useEffect(() => {
    const photo = new URLSearchParams(window.location.search).get('photo');
    if (photo) setSelected(photo);
  }, []);
  useEffect(() => {
    if (!current) return;
    returnFocus.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, [!!current]);
  function move(direction: number) {
    if (filtered.length) setSelected(filtered[(index + direction + filtered.length) % filtered.length].src);
  }
  return (
    <div ref={scope}>
      <div className="gallery-toolbar photo-gallery-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter photographs by subject">
          {['All photos', ...Array.from(new Set(gallery.map((g) => g.category)))].map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategory(c);
                setSelected(null);
                setVisible(PAGE_SIZE);
              }}
              aria-pressed={category === c}
              className={`filter-tab ${category === c ? 'active' : ''}`}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="gallery-sort">
          Sort by
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setVisible(PAGE_SIZE);
            }}
          >
            <option value="featured">Featured order</option>
            <option value="title">Title: A–Z</option>
            <option value="title-desc">Title: Z–A</option>
            <option value="category">Subject</option>
            {years.length > 0 && <option value="year-new">Year: newest first</option>}
            {years.length > 0 && <option value="year-old">Year: oldest first</option>}
          </select>
        </label>
      </div>
      {years.length > 0 && (
        <YearFilter
          years={years}
          value={year}
          hasUndated={gallery.some((g) => !g.year)}
          onChange={(value) => {
            setYear(value);
            setSelected(null);
            setVisible(PAGE_SIZE);
          }}
        />
      )}
      <div className="gallery-grid photo-only-gallery">
        {filtered.slice(0, visible).map((g, i) => (
          <button
            className="gallery-card"
            key={g.src + i}
            onClick={() => setSelected(g.src)}
            aria-label={'View photograph: ' + g.caption}
          >
            <span className="gallery-photo-mount">
              <TrustImage
                src={g.src}
                alt={g.caption}
                loading="lazy"
                sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
              />
            </span>
          </button>
        ))}
      </div>
      {filtered.length > visible && (
        <div className="gallery-more">
          <p role="status">
            Showing {Math.min(visible, filtered.length)} of {filtered.length} photographs
          </p>
          <button type="button" className="button" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more photographs
          </button>
        </div>
      )}
      {!filtered.length && <p className="gallery-empty">No photographs in this subject yet.</p>}
      {current && (
        <dialog
          ref={dialog}
          className="gallery-dialog photo-detail-dialog"
          data-lenis-prevent
          aria-labelledby="photo-detail-title"
          onCancel={(e) => {
            e.preventDefault();
            setSelected(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              move(1);
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              move(-1);
            }
          }}
        >
          <div className="gallery-dialog-top">
            <button autoFocus onClick={() => setSelected(null)} aria-label="Close photograph">
              <X size={22} />
            </button>
          </div>
          <figure>
            <div className="gallery-dialog-image">
              {loadedPhoto !== current.src && (
                <span className="gallery-photo-loading" role="status">
                  Loading photograph…
                </span>
              )}
              <TrustImage
                key={current.src}
                src={current.src}
                alt={current.caption}
                sizes="90vw"
                loading="eager"
                onLoad={() => setLoadedPhoto(current.src)}
              />
              <button
                className="photo-nav previous"
                disabled={filtered.length < 2}
                onClick={() => move(-1)}
                aria-label="Previous photograph"
              >
                <ChevronLeft />
              </button>
              <button
                className="photo-nav next"
                disabled={filtered.length < 2}
                onClick={() => move(1)}
                aria-label="Next photograph"
              >
                <ChevronRight />
              </button>
            </div>
            <figcaption>
              <span>
                {current.category}
                {current.year ? ' · ' + current.year : ''}
              </span>
              <h2 id="photo-detail-title">{current.caption}</h2>
              <p>{current.description}</p>
              <Link href={current.href} className="text-link">
                {current.href === '/about' ? 'More about the trust' : 'Explore this programme'}
              </Link>
            </figcaption>
          </figure>
        </dialog>
      )}
    </div>
  );
}
