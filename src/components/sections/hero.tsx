'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {gsap, useGSAP} from '@/lib/motion';
import {useSiteContent} from '@/components/site-content-provider';
import {IsoBadge} from '@/components/iso-badge';

/** The photographs in public/images/slides. Very wide ones fill the screen; the others are shown whole. */
const slides = [
  {
    src: '/images/slides/slide-v2-3.webp',
    alt: 'The trust’s volunteers standing with children and families at a community gathering',
    label: 'Together with our community',
    wide: true,
  },
  {
    src: '/images/slides/slide-02.jpeg',
    alt: 'Women of the community welcoming the trust’s volunteers with flowers outside the trust’s office',
    label: 'Warm welcomes, shared joy',
    wide: true,
  },
  {
    src: '/images/slides/slide-03.jpeg',
    alt: 'Volunteers and supporters of the trust standing together outside its office',
    label: 'People who give their time',
    wide: true,
  },
  {
    src: '/images/slides/slide-04.jpeg',
    alt: 'A group of girls in matching clothes smiling and making victory signs with their teachers',
    label: 'Bright futures, together',
    wide: true,
  },
  {
    src: '/images/slides/slide-05.jpeg',
    alt: 'Girls and their teachers giving a thumbs up for the camera',
    label: 'Every child counts',
    wide: true,
  },
  {
    src: '/images/slides/slide-06.jpeg',
    alt: 'Boys in blue uniforms with their teachers, smiling and giving thumbs up',
    label: 'Learning with confidence',
  },
  {
    src: '/images/slides/slide-07.jpeg',
    alt: 'Boys in blue uniforms crowding around their teacher with thumbs up',
    label: 'Smiles that say it all',
  },
  {
    src: '/images/slides/slide-08.jpeg',
    alt: 'Boys in blue uniforms sitting together on the floor during a lesson',
    label: 'Learning, together',
  },
];

export function Hero() {
  const {iso} = useSiteContent();
  const scope = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  // The slideshow keeps going by itself; it only holds still while someone points at it or tabs into it.
  const [hovered, setHovered] = useState(false);
  // Photographs are loaded only when they are showing or about to show, so the first screen stays quick.
  const ready = new Set([0, active, (active + 1) % slides.length]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    function sync() {
      clearInterval(timer);
      if (!hovered && !media.matches && !document.hidden)
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
  }, [hovered, active]);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
            {!ready.has(i) ? null : slide.wide ? (
              <Image src={slide.src} alt={slide.alt} fill priority={i === 0} sizes="100vw" quality={85} />
            ) : (
              <FitPhoto src={slide.src} alt={slide.alt} priority={i === 0} sizes="100vw" quality={85} />
            )}
          </div>
        ))}
      </div>
      <div className="photo-hero-shade" />
      <div className="experience-container photo-hero-content">
        <IsoBadge iso={iso} variant="hero" />
        <h1 id="hero-heading">
          Care you
          <br />
          can <em>trust.</em>
        </h1>
        <p>
          An ISO certified charitable trust in Silvassa, bringing education, essentials and everyday support
          to every child and family in our community.
        </p>
        <div className="photo-hero-actions">
          <Link href="/join" className="bright-button">
            Be part of the change
          </Link>
          <Link href="/our-work" className="hero-outline-button">
            Discover our work
          </Link>
        </div>
      </div>
      <div className="experience-container photo-hero-bottom">
        <a href="#community">Discover what brings us together</a>
        <div className="hero-slide-controls">
          <span className="hero-slide-label">{slides[active].label}</span>
          <div className="hero-slide-dots">
            {slides.map((s, i) => (
              <button
                key={s.src}
                aria-label={'Show photograph: ' + s.label}
                aria-pressed={active === i}
                className={active === i ? 'active' : ''}
                onClick={() => setActive(i)}
              >
                <span />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
