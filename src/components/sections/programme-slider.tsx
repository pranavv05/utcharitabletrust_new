'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Link from 'next/link';
import {useRef} from 'react';
import type {programmes as ProgrammeData} from '@/lib/content';
import {useAutoDrift} from '@/lib/use-auto-drift';

type Programme = Pick<(typeof ProgrammeData)[number], 'slug' | 'name' | 'description' | 'image' | 'color'>;
/** Enough repeated cards to fill the widest screen, so the loop is seamless without doubling the row. */
const COPIES = 4;

/** With this many programmes or fewer they all fit on a wide screen, so nothing needs to move. */
const FITS_ON_SCREEN = 3;

function Slide({programme: p, copy}: {programme: Programme; copy: boolean}) {
  return (
    <Link
      href={p.slug === 'book-bank' ? '/book-bank' : '/our-work/' + p.slug}
      className={'programme-slide accent-' + p.color}
      // The second copy only makes the loop seamless: hidden from screen readers and the keyboard.
      {...(copy ? {'aria-hidden': true, tabIndex: -1, inert: true} : {})}
    >
      <div className="programme-slide-photo">
        <FitPhoto
          src={p.image}
          alt={copy ? '' : p.name + ' programme'}
          sizes="(max-width:650px) 80vw,(max-width:1000px) 45vw,30vw"
          // The row drifts towards photographs that are off screen, so they are fetched up front (quietly,
          // after the first screen) instead of showing empty frames as they arrive.
          loading="eager"
          fetchPriority="low"
        />
      </div>
      <div className="programme-slide-copy">
        <h3>{p.name}</h3>
        <p>{p.description}</p>
        <span className="text-link">Discover the programme</span>
      </div>
    </Link>
  );
}

/** The programmes on the home page: a row of cards that drifts from left to right on its own. */
export function ProgrammeSlider({programmes}: {programmes: Programme[]}) {
  const rail = useRef<HTMLDivElement>(null);
  const drifting = programmes.length > FITS_ON_SCREEN;
  const copies = Math.min(COPIES, programmes.length);
  useAutoDrift(rail, {enabled: drifting, count: programmes.length, copies});
  function move(direction: number) {
    const el = rail.current;
    if (el)
      el.scrollBy({
        left:
          direction * (el.querySelector('a')?.getBoundingClientRect().width || el.clientWidth) +
          direction * 24,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
  }
  return (
    <div className="programme-slider">
      <div
        className={'programme-slider-rail' + (drifting ? ' drifting' : '')}
        ref={rail}
        tabIndex={0}
        role="region"
        aria-label="Our programmes"
        data-lenis-prevent
      >
        {programmes.map((p) => (
          <Slide key={p.slug} programme={p} copy={false} />
        ))}
        {drifting &&
          programmes.slice(0, copies).map((p) => <Slide key={'copy-' + p.slug} programme={p} copy />)}
      </div>
      <div className="programme-slider-footer">
        <div className="slider-buttons">
          <button onClick={() => move(-1)} aria-label="Previous programmes">
            Previous
          </button>
          <button onClick={() => move(1)} aria-label="Next programmes">
            Next
          </button>
        </div>
        <Link href="/our-work" className="outlined-link">
          All our programmes
        </Link>
      </div>
    </div>
  );
}
