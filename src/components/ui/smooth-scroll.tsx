'use client';
import {useCallback, useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';
import Lenis from 'lenis';
import {gsap, ScrollTrigger} from '@/lib/motion';
import {SmoothScrollContext} from '@/hooks/use-smooth-scroll';

export function SmoothScroll({children}: {children: React.ReactNode}) {
  const lenis = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const scrollTo = useCallback((target: string | number) => {
    const element = typeof target === 'string' ? document.getElementById(target.replace(/^#/, '')) : null;
    if (typeof target === 'string' && !element) return;
    if (lenis.current)
      lenis.current.scrollTo(element ?? Number(target), {
        offset: typeof target === 'string' ? -80 : 0,
        duration: 1.2,
      });
    else if (element)
      element.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    else window.scrollTo({top: Number(target), behavior: 'instant'});
  }, []);

  useEffect(() => {
    const media = matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
    let ticker: ((time: number) => void) | undefined;
    const setup = () => {
      if (ticker) gsap.ticker.remove(ticker);
      lenis.current?.destroy();
      lenis.current = null;
      if (!media.matches) return;
      const instance = new Lenis({
        duration: 1.15,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        prevent: (node) => Boolean(node.closest('[data-lenis-prevent]')),
      });
      instance.on('scroll', ScrollTrigger.update);
      ticker = (time) => instance.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);
      lenis.current = instance;
    };
    setup();
    media.addEventListener('change', setup);
    const anchors = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        url.pathname !== location.pathname ||
        !url.hash ||
        !document.getElementById(url.hash.slice(1))
      )
        return;
      event.preventDefault();
      scrollTo(url.hash);
      history.pushState(null, '', url.hash);
    };
    document.addEventListener('click', anchors);
    return () => {
      media.removeEventListener('change', setup);
      document.removeEventListener('click', anchors);
      if (ticker) gsap.ticker.remove(ticker);
      lenis.current?.destroy();
      lenis.current = null;
    };
  }, [scrollTo]);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      if (!disposed) ScrollTrigger.refresh();
    };
    const images = Array.from(document.images).filter((image) => !image.complete);
    images.forEach((image) => image.addEventListener('load', refresh, {once: true}));
    document.fonts.ready.then(refresh);
    const frame = requestAnimationFrame(refresh);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      images.forEach((image) => image.removeEventListener('load', refresh));
    };
  }, [pathname]);

  return <SmoothScrollContext.Provider value={{lenis, scrollTo}}>{children}</SmoothScrollContext.Provider>;
}
