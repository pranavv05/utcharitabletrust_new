'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import {gsap, useGSAP} from '@/lib/motion';
import {useSiteContent} from '@/components/site-content-provider';
import {IsoBadge} from '@/components/iso-badge';
const slides = [
  {
    src: '/images/banner.webp',
    alt: 'The trust with children and families in the community',
    label: 'A community that cares',
    wide: true,
  },
  {
    src: '/images/stationary/stationary3.webp',
    alt: 'Children at a school essentials distribution activity',
    label: 'Opening doors through education',
  },
  {
    src: '/images/blood/blood12.webp',
    alt: 'Volunteers supporting a community blood donation camp',
    label: 'Coming together to give back',
  },
];
export function Hero() {
  const {iso} = useSiteContent();
  const scope = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      clearInterval(timer);
      if (!paused && !hovered && !media.matches && !document.hidden)
        timer = setInterval(() => setActive((i) => (i + 1) % slides.length), 6500);
    }
    sync();
    media.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      media.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [paused, hovered]);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.photo-hero-content>*', {
          opacity: 0,
          y: 24,
          duration: 1,
          stagger: 0.12,
          ease: 'power3.out',
          delay: 0.1,
        });
      });
      return () => mm.revert();
    },
    {scope},
  );
  return (
    <section
      ref={scope}
      className="chapter photo-hero"
      id="purpose"
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      aria-label="Our community"
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
    >
      <div className="photo-hero-background">
        {slides.map((slide, i) => (
          <div
            className={'photo-hero-slide' + (active === i ? ' active' : '')}
            key={slide.src}
            aria-hidden={active !== i}
          >
            {slide.wide ? (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : 'eager'}
                sizes="100vw"
                quality={85}
              />
            ) : (
              <FitPhoto
                src={slide.src}
                alt={slide.alt}
                priority={i === 0}
                loading={i === 0 ? undefined : 'eager'}
                sizes="100vw"
                quality={85}
              />
            )}
          </div>
        ))}
      </div>
      <div className="photo-hero-shade" />
      <div className="experience-container photo-hero-content">
        <p className="photo-hero-eyebrow">ROOTED IN SILVASSA. OPEN TO EVERYONE.</p>
        <h1 id="hero-heading">
          Humanity.
          <br />
          In <em>action.</em>
        </h1>
        <p>For every child with a dream. For every family finding its way. For the community we call home.</p>
        <div className="photo-hero-actions">
          <Link href="/join" className="bright-button">
            Be part of the change
          </Link>
          <Link href="/our-work" className="hero-outline-button">
            Discover our work
          </Link>
        </div>
        <IsoBadge iso={iso} variant="line" />
      </div>
      <div className="experience-container photo-hero-bottom">
        <a href="#community">Discover what brings us together</a>
        <div className="hero-slide-controls">
          <span className="hero-slide-label" aria-live={paused ? 'polite' : 'off'}>
            {slides[active].label}
          </span>
          <div className="hero-slide-dots">
            {slides.map((s, i) => (
              <button
                key={s.src}
                aria-label={'Show photograph: ' + s.label}
                aria-pressed={active === i}
                className={active === i ? 'active' : ''}
                onClick={() => {
                  setActive(i);
                  setPaused(true);
                }}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            className="hero-pause"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      </div>
    </section>
  );
}
