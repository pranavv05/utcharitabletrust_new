'use client';
import Link from 'next/link';
import {useMemo, useState} from 'react';
import {Play} from 'lucide-react';
import {FitPhoto} from '@/components/ui/fit-photo';
import {YearFilter} from '@/components/year-filter';
import {byYear, monthYear, yearsOf, type YearFilter as YearValue} from '@/lib/media';
import type {NewsItem} from '@/lib/site-content';

const PAGE = 12;

export function NewsList({news}: {news: NewsItem[]}) {
  const [year, setYear] = useState<YearValue>('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE);
  const years = useMemo(() => yearsOf(news), [news]);
  const categories = useMemo(() => Array.from(new Set(news.map((n) => n.category))).sort(), [news]);
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return byYear(news, year)
      .filter((n) => category === 'all' || n.category === category)
      .filter((n) => !needle || (n.title + ' ' + n.summary + ' ' + n.body).toLowerCase().includes(needle))
      .toSorted((a, b) =>
        sort === 'oldest'
          ? a.date.localeCompare(b.date)
          : sort === 'title'
            ? a.title.localeCompare(b.title)
            : b.date.localeCompare(a.date),
      );
  }, [news, year, category, sort, query]);
  const reset = () => setVisible(PAGE);
  if (!news.length)
    return (
      <p className="gallery-empty">
        News and media stories will appear here soon. Follow us on social media for the latest updates.
      </p>
    );
  return (
    <>
      <div className="gallery-toolbar photo-gallery-toolbar sx-toolbar">
        <YearFilter
          years={years}
          value={year}
          hasUndated={news.some((n) => !n.year)}
          onChange={(value) => {
            setYear(value);
            reset();
          }}
        />
        <div className="sx-controls">
          <label className="gallery-sort">
            Search
            <input
              type="search"
              value={query}
              placeholder="Search stories"
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
            />
          </label>
          {categories.length > 1 && (
            <label className="gallery-sort">
              Category
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  reset();
                }}
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <label className="gallery-sort">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
      </div>
      <p className="sx-count" role="status">
        {items.length} {items.length === 1 ? 'story' : 'stories'}
      </p>
      <div className="sx-grid">
        {items.slice(0, visible).map((n) => (
          <Link key={n.id} href={'/news/' + n.slug} className="sx-card">
            <div className="sx-card-photo">
              {n.image ? (
                <FitPhoto src={n.image} alt="" sizes="(max-width:700px) 100vw,(max-width:1100px) 50vw,33vw" />
              ) : null}
              {(n.videoUrl || n.videoFile) && (
                <span className="sx-badge">
                  <Play size={14} fill="currentColor" /> Video
                </span>
              )}
            </div>
            <div className="sx-card-body">
              <p className="sx-meta">
                {n.category}
                {n.date ? ' · ' + monthYear(n.date) : ''}
              </p>
              <h3>{n.title}</h3>
              {n.summary && <p>{n.summary}</p>}
              <span className="sx-more">Read more →</span>
            </div>
          </Link>
        ))}
      </div>
      {!items.length && <p className="gallery-empty">No stories match these filters.</p>}
      {items.length > visible && (
        <div className="gallery-more">
          <p role="status">
            Showing {visible} of {items.length} stories
          </p>
          <button type="button" className="button" onClick={() => setVisible((v) => v + PAGE)}>
            Show more stories
          </button>
        </div>
      )}
    </>
  );
}
