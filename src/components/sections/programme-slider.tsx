'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Image from 'next/image';
import Link from 'next/link';
import {useRef, useState, useEffect} from 'react';
import type {programmes as ProgrammeData} from '@/lib/content';
export function ProgrammeSlider({programmes}: {programmes: typeof ProgrammeData}) {
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({start: true, end: false});
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    function update() {
      if (el) setEdges({start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4});
    }
    update();
    el.addEventListener('scroll', update, {passive: true});
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [programmes]);
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
        className="programme-slider-rail"
        ref={rail}
        tabIndex={0}
        role="region"
        aria-label="Our programmes"
        data-lenis-prevent
      >
        {programmes.map((p) => (
          <Link
            key={p.slug}
            href={p.slug === 'book-bank' ? '/book-bank' : '/our-work/' + p.slug}
            className={'programme-slide accent-' + p.color}
          >
            <div className="programme-slide-photo">
              <FitPhoto
                src={p.image}
                alt={p.name + ' programme'}
                sizes="(max-width:650px) 80vw,(max-width:1000px) 45vw,30vw"
              />
            </div>
            <div className="programme-slide-copy">
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <span className="text-link">Discover the programme</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="programme-slider-footer">
        <div className="slider-buttons">
          <button onClick={() => move(-1)} disabled={edges.start}>
            Previous
          </button>
          <button onClick={() => move(1)} disabled={edges.end}>
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
