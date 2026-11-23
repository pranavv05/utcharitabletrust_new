'use client';
import {useRef} from 'react';
import {gsap, useGSAP, ScrollTrigger} from '@/lib/motion';
export function VelocityMarquee() {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const animation = gsap.to('.marquee-track', {
        xPercent: -50,
        duration: 28,
        repeat: -1,
        ease: 'power1.inOut',
      });
      const trigger = ScrollTrigger.create({
        onUpdate: (self) => {
          const velocity = Math.min(Math.abs(self.getVelocity()) / 1500, 2);
          gsap.to(animation, {
            timeScale: (self.direction === -1 ? -1 : 1) * (1 + velocity),
            duration: 0.8,
            ease: 'power3.out',
            overwrite: true,
          });
        },
      });
      return () => {
        animation.kill();
        trigger.kill();
      };
    },
    {scope},
  );
  return (
    <div ref={scope} className="velocity-marquee" aria-hidden="true">
      <div className="marquee-track">
        {Array.from({length: 4}, (_, index) => (
          <span key={index}>
            A little care <i>✳</i> A world of possibility <i>✳</i> ISO certified trust <i>✳</i>{' '}
          </span>
        ))}
      </div>
    </div>
  );
}
