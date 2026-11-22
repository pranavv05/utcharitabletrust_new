import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger, useGSAP);
export { gsap, ScrollTrigger, useGSAP };
export const motionTokens = {
  fast: 0.4,
  standard: 0.8,
  slow: 1.2,
  revealEase: 'power3.out',
  transitionEase: 'power4.inOut',
  floatEase: 'expo.out',
} as const;
