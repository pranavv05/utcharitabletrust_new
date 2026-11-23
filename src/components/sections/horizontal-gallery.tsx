'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Link from 'next/link';
import {useRef} from 'react';
import {useSiteContent} from '@/components/site-content-provider';
import {useAutoDrift} from '@/lib/use-auto-drift';
import {uniquePeople} from '@/lib/media';

type Photo = {src: string; caption: string; category: string; year?: string};
type Moment =
  | {type: 'photo'; key: string; photo: Photo}
  | {type: 'stat'; key: string; figure: number; label: string; detail: string; href: string; cta: string};

/** With this few moments a drifting row would leave gaps, so it stays still. */
const MIN_TO_DRIFT = 5;

/** Every moment is the same size, whatever it is, so the row stays even. */
function Tile({moment, copy}: {moment: Moment; copy: boolean}) {
  // The second copy only makes the loop seamless: hidden from screen readers and the keyboard.
  const hidden = copy ? ({'aria-hidden': true, inert: true} as const) : {};
  if (moment.type === 'photo') {
    const {photo} = moment;
    return (
      <Link
        href={'/gallery?photo=' + encodeURIComponent(photo.src)}
        className="moment moment-photo"
        tabIndex={copy ? -1 : undefined}
        {...hidden}
      >
        <FitPhoto src={photo.src} alt={copy ? '' : photo.caption} sizes="320px" />
        <span className="moment-caption">
          <strong>{photo.caption}</strong>
          <small>{[photo.category, photo.year].filter(Boolean).join(' · ')}</small>
        </span>
      </Link>
    );
  }
  return (
    <Link href={moment.href} className="moment moment-stat" tabIndex={copy ? -1 : undefined} {...hidden}>
      <strong>{moment.figure.toLocaleString('en-IN')}</strong>
      <span>{moment.label}</span>
      <small>{moment.detail}</small>
      <em>{moment.cta} →</em>
    </Link>
  );
}

/**
 * "People. Not just pictures.": every gallery photograph, in equal frames, drifting from left to right on their own, with the real numbers of the people behind the
 * work slipped in. Everything comes from the admin panel.
 */
export function HorizontalGallery() {
  const {gallery, team, colleges, partners} = useSiteContent();
  const photos: Photo[] = gallery;
  const stats: Moment[] = [];
  const people = uniquePeople(team).length;
  if (people)
    stats.push({
      type: 'stat',
      key: 'stat-team',
      figure: people,
      label: people === 1 ? 'Trust member' : 'Trust members',
      detail: 'who guide the work',
      href: '/team',
      cta: 'Meet the team',
    });
  const interns = colleges.reduce((sum, c) => sum + c.interns, 0);
  if (interns)
    stats.push({
      type: 'stat',
      key: 'stat-interns',
      figure: interns,
      label: interns === 1 ? 'Intern' : 'Interns',
      detail: `from ${colleges.length} ${colleges.length === 1 ? 'college' : 'colleges'}`,
      href: '/interns',
      cta: 'See where they study',
    });
  if (partners.length)
    stats.push({
      type: 'stat',
      key: 'stat-partners',
      figure: partners.length,
      label: partners.length === 1 ? 'Partner' : 'Partners',
      detail: 'who stand with us',
      href: '/partners',
      cta: 'Meet our partners',
    });
  const moments: Moment[] = photos.map((photo, i) => ({type: 'photo', key: 'photo-' + i + photo.src, photo}));
  // The people counts go a quarter, half and three quarters of the way along.
  stats.forEach((stat, i) =>
    moments.splice(Math.round((moments.length * (i + 1)) / (stats.length + 1)) + i, 0, stat),
  );

  const shell = useRef<HTMLDivElement>(null);
  const drifting = moments.length >= MIN_TO_DRIFT;
  useAutoDrift(shell, {enabled: drifting, count: moments.length, nested: true, speed: 42});
  function move(n: number) {
    shell.current?.scrollBy({
      left: n * (shell.current.clientWidth * 0.75),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  return (
    <section id="moments" className="chapter horizontal-chapter photo-moments">
      <div className="experience-container gallery-chapter-head">
        <div>
          <span className="chapter-tag">THROUGH OUR LENS</span>
          <h2>
            People.
            <br />
            <em>Not just pictures.</em>
          </h2>
          <p className="moments-lead">Moments from our work and the people who make it happen.</p>
        </div>
        <Link href="/gallery" className="outlined-link">
          Explore gallery
        </Link>
      </div>
      <div
        className={'horizontal-scroll-shell' + (drifting ? ' drifting' : '')}
        ref={shell}
        tabIndex={0}
        role="region"
        aria-label="Photographs, student videos and people of the trust"
        data-lenis-prevent
      >
        <div className="horizontal-track">
          {moments.map((moment) => (
            <Tile key={moment.key} moment={moment} copy={false} />
          ))}
          {drifting && moments.map((moment) => <Tile key={'copy-' + moment.key} moment={moment} copy />)}
        </div>
      </div>
      <div className="experience-container moments-controls slider-buttons">
        <button onClick={() => move(-1)}>Previous</button>
        <button onClick={() => move(1)}>Next</button>
      </div>
    </section>
  );
}
