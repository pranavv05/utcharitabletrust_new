'use client';
import {useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {gsap} from '@/lib/motion';
import {useMousePosition} from '@/hooks/use-mouse-position';
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const mouse = useMousePosition();
  useEffect(() => {
    const media = matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!enabled || !root.current || !ring.current || !dot.current) return;
    const x = gsap.quickTo(ring.current, 'x', {duration: 0.4, ease: 'power3.out'});
    const y = gsap.quickTo(ring.current, 'y', {duration: 0.4, ease: 'power3.out'});
    const move = () => {
      x(mouse.current.x);
      y(mouse.current.y);
      gsap.set(dot.current, {x: mouse.current.x, y: mouse.current.y});
    };
    const over = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor],a,button');
      const text = target?.dataset.cursor ?? '';
      const nextPreview = target?.dataset.preview ?? null;
      setPreview((current) => (current === nextPreview ? current : nextPreview));
      if (label.current) label.current.textContent = text;
      root.current?.setAttribute('data-active', text ? 'label' : target ? 'link' : 'idle');
      root.current?.setAttribute('data-visible', 'true');
    };
    const hide = () => root.current?.setAttribute('data-visible', 'false');
    gsap.ticker.add(move);
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerleave', hide);
    return () => {
      gsap.ticker.remove(move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerleave', hide);
      gsap.killTweensOf([ring.current, dot.current]);
    };
  }, [enabled, mouse]);
  if (!enabled) return null;
  return (
    <div ref={root} className="custom-cursor" data-visible="false" aria-hidden="true">
      <div ref={dot} className="cursor-dot" />
      <div ref={ring} className="cursor-ring">
        <span ref={label} />
        {preview && (
          <div className="cursor-image-preview">
            <Image src={preview} alt="" fill sizes="180px" />
          </div>
        )}
      </div>
    </div>
  );
}
