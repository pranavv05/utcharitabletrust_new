'use client';
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/motion';
export function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const element = ref.current; if (!element || !matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const move = (event: PointerEvent) => { const r=element.getBoundingClientRect(); gsap.to(element, { rotateY:(event.clientX-r.left-r.width/2)/r.width*5, rotateX:-(event.clientY-r.top-r.height/2)/r.height*5, transformPerspective:1000, duration:.4, ease:'power3.out', overwrite:true }); };
    const leave = () => gsap.to(element, { rotateX:0, rotateY:0, duration:.8, ease:'expo.out', overwrite:true });
    element.addEventListener('pointermove',move);element.addEventListener('pointerleave',leave);
    return () => {element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',leave);};
  },{scope:ref});
  return <div ref={ref} className={className}>{children}</div>;
}
