'use client';
import {useRef} from 'react';
import {gsap, useGSAP} from '@/lib/motion';
import {useSiteContent} from '@/components/site-content-provider';
const statement = 'A stronger community is built one act of care at a time.';
export function TrustNumbers() {
  const {programmeCount} = useSiteContent();
  const scope = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '.highlight-word',
          {opacity: 0.22},
          {
            opacity: 1,
            stagger: 0.12,
            ease: 'power1.inOut',
            scrollTrigger: {trigger: '.scroll-statement', start: 'top 80%', end: 'bottom 35%', scrub: 0.5},
          },
        );
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((element) => {
          const target = Number(element.dataset.count);
          const count = {value: 0};
          gsap.to(count, {
            value: target,
            duration: 1.2,
            ease: 'power3.out',
            snap: {value: 1},
            onUpdate: () => {
              element.textContent = String(count.value).padStart(2, '0');
            },
            scrollTrigger: {trigger: element, start: 'top 90%', once: true},
          });
        });
      });
      return () => mm.revert();
    },
    {scope, dependencies: [programmeCount], revertOnUpdate: true},
  );
  return (
    <section ref={scope} id="in-numbers" className="chapter numbers-chapter">
      <div className="experience-container">
        <span className="chapter-tag">OUR SHARED PURPOSE</span>
        <h2 className="scroll-statement" aria-label={statement}>
          {statement.split(' ').map((word, index) => (
            <span key={index} className="highlight-word" aria-hidden="true">
              {word}{' '}
            </span>
          ))}
        </h2>
        <div className="trust-number-grid">
          <div>
            <strong data-count={programmeCount}>{String(programmeCount).padStart(2, '0')}</strong>
            <h3>Community programmes</h3>
            <p>Education, health, and practical support.</p>
          </div>
          <div>
            <strong data-count={3}>03</strong>
            <h3>Areas of focus</h3>
            <p>Different needs. A shared commitment.</p>
          </div>
          <div>
            <strong data-count={1}>01</strong>
            <h3>Community at heart</h3>
            <p>Rooted in Silvassa. Here for each other.</p>
          </div>
        </div>
        <p className="numbers-note">Our programme structure, drawn from the trust’s published activities.</p>
      </div>
    </section>
  );
}
