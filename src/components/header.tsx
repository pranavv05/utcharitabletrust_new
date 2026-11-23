'use client';
import {gmailLink, whatsappLink, trustContacts} from '@/lib/contact-links';
import {BrandLogo} from '@/components/brand-logo';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'framer-motion';
import {useSmoothScroll} from '@/hooks/use-smooth-scroll';
import {useSiteContent} from '@/components/site-content-provider';
import {IsoBadge} from '@/components/iso-badge';
const links = [
  ['Our story', '/about'],
  ['Our work', '/our-work'],
  ['Book bank', '/book-bank'],
  ['Moments', '/gallery'],
  ['News & Media', '/news'],
  ['Get in touch', '/contact'],
];

export function Header() {
  const {iso} = useSiteContent();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const path = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const {lenis} = useSmoothScroll();
  const reduced = useReducedMotion();
  useEffect(() => {
    setOpen(false);
    setHidden(false);
  }, [path]);
  useEffect(() => {
    let previous = window.scrollY;
    let frame = 0;
    const scroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - previous) > 6) {
          setHidden(y > previous && y > 160);
          previous = y;
        }
        frame = 0;
      });
    };
    window.addEventListener('scroll', scroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lenis.current?.stop();
    document.querySelector('main')?.setAttribute('inert', '');
    document.querySelector('footer')?.setAttribute('inert', '');
    const focusFrame = requestAnimationFrame(() =>
      menu.current?.querySelector<HTMLElement>('button,a')?.focus(),
    );
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key === 'Tab') {
        const focusable = Array.from(menu.current?.querySelectorAll<HTMLElement>('button,a[href]') ?? []);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previous;
      lenis.current?.start();
      document.querySelector('main')?.removeAttribute('inert');
      document.querySelector('footer')?.removeAttribute('inert');
      document.removeEventListener('keydown', keys);
    };
  }, [open, lenis]);
  return (
    <>
      <motion.header
        className="immersive-nav"
        animate={{y: hidden && !open ? '-110%' : '0%'}}
        transition={{duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1]}}
        onFocusCapture={() => setHidden(false)}
      >
        <Link href="/" className="immersive-brand" aria-label="UT Charitable Trust home">
          <BrandLogo />
        </Link>
        <IsoBadge iso={iso} />
        <nav className="quiet-nav" aria-label="Main navigation">
          <Link href="/our-work" aria-current={path === '/our-work' ? 'page' : undefined}>
            Our work
          </Link>
          <Link href="/team" aria-current={path === '/team' ? 'page' : undefined}>
            Our people
          </Link>
          <Link href="/book-bank" aria-current={path === '/book-bank' ? 'page' : undefined}>
            Book bank
          </Link>
          <Link href="/join" className="nav-involve">
            Get involved <span aria-hidden="true">+</span>
          </Link>
        </nav>
        <div className="nav-utilities">
          <button
            ref={toggle}
            className="immersive-menu-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="full-menu"
            onClick={() => {
              setHidden(false);
              setOpen(!open);
            }}
          >
            <span>MENU</span>
            <i />
            <i />
          </button>
        </div>
      </motion.header>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            className="fullscreen-menu"
            id="full-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            initial={{opacity: 0, y: reduced ? 0 : -30}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: reduced ? 0 : -20}}
            transition={{duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1]}}
            data-lenis-prevent
          >
            <div className="menu-top">
              <span className="overline">UT CHARITABLE TRUST</span>
              <button
                className="menu-close"
                onClick={() => {
                  setOpen(false);
                  toggle.current?.focus();
                }}
                aria-label="Close full menu"
              >
                CLOSE <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="fullscreen-menu-grid">
              <nav aria-label="Full navigation">
                {links.map(([name, href], index) => (
                  <motion.div
                    key={href}
                    initial={{opacity: 0, y: reduced ? 0 : 35}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.6, delay: reduced ? 0 : 0.08 * index, ease: [0.22, 1, 0.36, 1]}}
                  >
                    <Link href={href} onClick={() => setOpen(false)}>
                      <span>0{index + 1}</span>
                      {name}
                    </Link>
                  </motion.div>
                ))}
              </nav>
              <div className="menu-aside">
                <p>
                  People helping people.
                  <br />
                  That’s where it begins.
                </p>
                <Link href="/team" onClick={() => setOpen(false)}>
                  Our people
                </Link>
                <Link href="/president-message" onClick={() => setOpen(false)}>
                  President’s message
                </Link>
                <Link href="/legal" onClick={() => setOpen(false)}>
                  Legal documents
                </Link>
                <Link href="/partners" onClick={() => setOpen(false)}>
                  Our partners
                </Link>
                <Link href="/testimonials" onClick={() => setOpen(false)}>
                  Testimonials
                </Link>
                <Link href="/interns" onClick={() => setOpen(false)}>
                  Our interns
                </Link>
                <Link href="/join" onClick={() => setOpen(false)}>
                  Become a member
                </Link>
                <a href={gmailLink()} target="_blank" rel="noopener noreferrer">
                  help@utcharitabletrust.com
                </a>
                <a href={whatsappLink(trustContacts.phone.digits)} target="_blank" rel="noopener noreferrer">
                  +91 93779 58582
                </a>
              </div>
            </div>
            <div className="menu-bottom">
              <span>SILVASSA · DADRA AND NAGAR HAVELI</span>
              <span>ROOTED IN COMMUNITY</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
