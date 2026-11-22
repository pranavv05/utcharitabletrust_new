'use client';
import {FitPhoto} from '@/components/ui/fit-photo';
import Image from 'next/image';
import Link from 'next/link';
import {useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
const principles = [
  {
    title: 'A shared vision.',
    quote:
      'Only when we work together and accept no boundaries in attaining our goals for sustainable development will our vision for the holistic development of society be realized.',
    attribution: 'Mr. Pradip Mishra',
    role: 'President, UT Charitable Trust',
    image: '/images/pradip.webp',
    href: '/president-message',
    link: 'Read the president’s message',
    isQuote: true,
  },
  {
    title: 'Care with dignity.',
    quote:
      'Our work begins with listening and respect. We support people as members of a shared community, with practical help that responds to everyday needs.',
    attribution: 'Our approach',
    role: 'Community-led support',
    image: '/images/cloth/cloth3.webp',
    href: '/about',
    link: 'Know the trust',
    isQuote: false,
  },
  {
    title: 'Trust, made visible.',
    quote:
      'Meet the people behind our work and explore the certificates published by the trust. Knowing an organisation is part of choosing how to support it.',
    attribution: 'Our commitment',
    role: 'People and transparency',
    image: '/images/gallery/gallery4.webp',
    href: '/certificates',
    link: 'View our certificates',
    isQuote: false,
  },
];
export function Voices() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const item = principles[active];
  return (
    <section id="our-promise" className="chapter voices-chapter">
      <div className="experience-container">
        <span className="chapter-tag">THE PEOPLE BEHIND THE PURPOSE</span>
        <div className="voices-grid">
          <div className="voice-image">
            <FitPhoto src={item.image} alt={item.attribution} sizes="(max-width: 700px) 100vw, 35vw" />
          </div>
          <div className="voice-content">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduced ? false : {opacity: 0, y: 18}}
                animate={{opacity: 1, y: 0}}
                exit={reduced ? undefined : {opacity: 0, y: -12}}
                transition={{duration: 0.4, ease: [0.22, 1, 0.36, 1]}}
              >
                <p className="overline">{item.title}</p>
                {item.isQuote ? (
                  <blockquote>“{item.quote}”</blockquote>
                ) : (
                  <p className="principle-statement">{item.quote}</p>
                )}
                <div className="voice-attribution">
                  <strong>{item.attribution}</strong>
                  <span>{item.role}</span>
                </div>
                <Link className="draw-link" href={item.href}>
                  {item.link}
                </Link>
              </motion.div>
            </AnimatePresence>
            <div className="voice-selectors" role="group" aria-label="Choose a trust perspective">
              {principles.map((p, index) => (
                <button
                  key={p.title}
                  onClick={() => setActive(index)}
                  aria-pressed={active === index}
                  aria-label={p.title}
                >
                  <span>0{index + 1}</span>
                  <i />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
