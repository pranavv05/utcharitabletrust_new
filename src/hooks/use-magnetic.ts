'use client';
import type {RefObject} from 'react';
import {gsap, useGSAP} from '@/lib/motion';
export function useMagnetic(ref: RefObject<HTMLElement | null>, strength = 0.15) {
  useGSAP(
    () => {
      const element = ref.current;
      if (
        !element ||
        !matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches
      )
        return;
      const move = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        gsap.to(element, {
          x: (event.clientX - rect.left - rect.width / 2) * strength,
          y: (event.clientY - rect.top - rect.height / 2) * strength,
          duration: 0.4,
          ease: 'power3.out',
          overwrite: true,
        });
      };
      const leave = () => gsap.to(element, {x: 0, y: 0, duration: 0.8, ease: 'expo.out', overwrite: true});
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerleave', leave);
      return () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerleave', leave);
        gsap.killTweensOf(element);
      };
    },
    {scope: ref},
  );
}
