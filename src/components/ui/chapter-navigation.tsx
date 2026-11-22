'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger } from '@/lib/motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
export const chapters = [{id:'purpose',label:'Purpose'},{id:'community',label:'Community'},{id:'our-work',label:'Our work'},{id:'take-part',label:'Take part'},{id:'in-numbers',label:'In numbers'},{id:'moments',label:'Moments'},{id:'our-promise',label:'Our promise'},{id:'together',label:'Together'}];
export function ChapterNavigation() {
  const path = usePathname(); const progress = useRef<HTMLDivElement>(null); const [active, setActive] = useState('purpose'); const { scrollTo } = useSmoothScroll();
  useEffect(() => {
    const trigger = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: self => gsap.set(progress.current, { scaleX: self.progress }) });
    if (path !== '/') return () => trigger.kill();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); }), { rootMargin: '-25% 0px -45% 0px', threshold: 0 });
    chapters.forEach(chapter => { const element = document.getElementById(chapter.id); if (element) observer.observe(element); });
    return () => { trigger.kill(); observer.disconnect(); };
  }, [path]);
  return <><div className="reading-progress" aria-hidden="true"><div ref={progress}/></div>{path === '/' && <nav className="chapter-navigation" aria-label="Story chapters">{chapters.map((chapter, index) => <a key={chapter.id} href={`#${chapter.id}`} aria-label={`Chapter ${index + 1}: ${chapter.label}`} aria-current={active === chapter.id ? 'location' : undefined} onClick={event => { event.preventDefault(); scrollTo(chapter.id); history.pushState(null, '', `#${chapter.id}`); }}><span className="chapter-nav-label">{chapter.label}</span><span className="chapter-nav-dot"/></a>)}</nav>}</>;
}
