'use client';
import type { RefObject } from 'react';
import { gsap, useGSAP, motionTokens } from '@/lib/motion';
export function useReveal(scope: RefObject<HTMLElement | null>) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.utils.toArray<HTMLElement>('[data-reveal]', scope.current).forEach(element => {
        gsap.from(element, { y: 40, opacity: 0, duration: motionTokens.standard, ease: motionTokens.revealEase, scrollTrigger: { trigger: element, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('.programme-image-frame', scope.current).forEach(frame => {
        gsap.from(frame, { clipPath: 'inset(12% 0% 12% 0%)', duration: motionTokens.slow, ease: motionTokens.revealEase, scrollTrigger: { trigger: frame, start: 'top 90%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('[data-parallax]', scope.current).forEach(element => {
        gsap.fromTo(element, { yPercent: -5, scale: 1.1 }, { yPercent: 5, scale: 1.02, ease: 'power1.inOut', scrollTrigger: { trigger: element.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 } });
      });
    });
    return () => mm.revert();
  }, { scope });
}
