/** Helpers for the News & Media, Testimonials and other CMS sections. */

/** Turns a YouTube or Vimeo watch link into a privacy-friendly embed URL, or null for anything else. */
export function videoEmbed(url: string | undefined): string | null {
  if (!url) return null;
  const youtube = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(
    url,
  );
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0`;
  const vimeo = /^https:\/\/(?:www\.)?vimeo\.com\/(\d{5,15})/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

/** Four-digit year from a YYYY-MM-DD date or a plain year string; '' when there is none. */
export function yearOf(value: string | undefined): string {
  const match = /^(\d{4})/.exec(value || '');
  return match ? match[1] : '';
}

/** Distinct years, newest first, from a list of items that each may have a year. */
export function yearsOf(items: {year?: string}[]): string[] {
  return Array.from(new Set(items.map((i) => i.year).filter((y): y is string => !!y))).sort((a, b) =>
    b.localeCompare(a),
  );
}

export const monthYear = (date: string) => {
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isNaN(parsed.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
};

/** Splits the newline-separated list of extra photographs stored with a news item. */
export const photoList = (value: string | undefined) =>
  (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export type Year = string;
export type YearFilter = 'all' | 'undated' | Year;
/** Applies a year filter chosen on a page: 'all', a four-digit year, or items with no year. */
export function byYear<T extends {year?: string}>(items: T[], filter: YearFilter): T[] {
  if (filter === 'all') return items;
  if (filter === 'undated') return items.filter((i) => !i.year);
  return items.filter((i) => i.year === filter);
}

/** The name given to student videos added in bulk; it is not shown to visitors, only a real name is. */
export const GENERIC_STUDENT_NAME = 'Student';
