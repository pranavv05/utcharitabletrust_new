'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useRef} from 'react';
import {useAutoDrift} from '@/lib/use-auto-drift';

type Photo = {src: string; caption: string; category: string; year?: string};
export type Moment =
  | {type: 'photo'; key: string; photo: Photo}
  | {type: 'stat'; key: string; figure: number; label: string; detail: string; href: string; cta: string};

/** With this few moments a drifting row would leave gaps, so it stays still. */
const MIN_TO_DRIFT = 5;
/**
 * To loop without a visible jump, only the first few moments are repeated at the end (enough to fill the
 * widest screen), not the whole list. That keeps the page small however many photographs there are.
 */
const COPIES = 8;

/** Every moment is the same size, whatever it is, so the row stays even. */
function Tile({moment, copy}: {moment: Moment; copy: boolean}) {
  // The repeated tiles only make the loop seamless: hidden from screen readers and the keyboard.
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
        <Image src={photo.src} alt={copy ? '' : photo.caption} fill sizes="320px" className="moment-img" />
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

/** The drifting row of photographs and people counts, with Previous and Next buttons. */
export function MomentsReel({moments}: {moments: Moment[]}) {
  const shell = useRef<HTMLDivElement>(null);
  const drifting = moments.length >= MIN_TO_DRIFT;
  const copies = Math.min(COPIES, moments.length);
  useAutoDrift(shell, {enabled: drifting, count: moments.length, copies, nested: true, speed: 42});
  function move(n: number) {
    shell.current?.scrollBy({
      left: n * (shell.current.clientWidth * 0.75),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  return (
    <>
      <div
        className={'horizontal-scroll-shell' + (drifting ? ' drifting' : '')}
        ref={shell}
        tabIndex={0}
        role="region"
        aria-label="Photographs and people of the trust"
        data-lenis-prevent
      >
        <div className="horizontal-track">
          {moments.map((moment) => (
            <Tile key={moment.key} moment={moment} copy={false} />
          ))}
          {drifting &&
            moments
              .slice(0, copies)
              .map((moment) => <Tile key={'copy-' + moment.key} moment={moment} copy />)}
        </div>
      </div>
      <div className="experience-container moments-controls slider-buttons">
        <button onClick={() => move(-1)}>Previous</button>
        <button onClick={() => move(1)}>Next</button>
      </div>
    </>
  );
}
