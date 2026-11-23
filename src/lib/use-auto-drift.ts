'use client';
import {useEffect, type RefObject} from 'react';

/**
 * Makes a horizontally scrollable row drift by itself from left to right, forever.
 *
 * The row (or, with `nested`, the track inside it) must contain its items twice in a row (the second copy is what makes the loop seamless);
 * `count` is how many items one copy has. Scrolling by hand, the Previous/Next buttons, hovering,
 * keyboard focus and touching all pause the drift, and it carries on a couple of seconds after the
 * visitor stops. It never runs for people who prefer reduced motion, while the row is off screen or
 * while the tab is in the background. Pass `enabled: false` to leave the row alone.
 */
export function useAutoDrift(
  ref: RefObject<HTMLElement | null>,
  {
    enabled,
    count,
    speed = 38,
    nested = false,
  }: {enabled: boolean; count: number; speed?: number; nested?: boolean},
) {
  useEffect(() => {
    const row = ref.current;
    if (!enabled || !row || count < 1) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // `nested`: the items sit inside a single track element within the scrolling row.
    const list = nested ? row.firstElementChild : row;
    const items = Array.from(list?.children ?? []) as HTMLElement[];
    if (items.length < count * 2) return;

    // One copy's width: how far the second copy starts after the first.
    const loop = () => items[count].offsetLeft - items[0].offsetLeft;
    let position = loop();
    row.scrollLeft = position;
    let frame = 0;
    let last = 0;
    let pausedUntil = 0;
    let hovering = false;
    let focused = false;
    let visible = false;

    const pause = (ms = 2500) => {
      pausedUntil = performance.now() + ms;
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const delta = Math.min(64, now - last) / 1000;
      last = now;
      if (!visible || hovering || focused || document.hidden || now < pausedUntil) return;
      const width = loop();
      if (width <= 0) return;
      position -= speed * delta;
      if (position <= 0) position += width;
      row.scrollLeft = position;
    };
    // A scroll we did not cause (wheel, drag, touch, buttons) takes over and pauses the drift.
    const onScroll = () => {
      if (Math.abs(row.scrollLeft - position) <= 2) return;
      const width = loop();
      let at = row.scrollLeft;
      if (width > 0) {
        if (at <= 1) at += width;
        else if (at >= row.scrollWidth - row.clientWidth - 1) at -= width;
        if (at !== row.scrollLeft) row.scrollLeft = at;
      }
      position = at;
      pause();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = true;
    };
    const onLeave = () => {
      hovering = false;
      pause(800);
    };
    const onTouch = () => pause(4000);
    const onFocusIn = () => (focused = true);
    const onFocusOut = () => {
      focused = false;
      pause(800);
    };
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(row);
    row.addEventListener('scroll', onScroll, {passive: true});
    row.addEventListener('pointerenter', onEnter);
    row.addEventListener('pointerleave', onLeave);
    row.addEventListener('pointerdown', onTouch);
    row.addEventListener('focusin', onFocusIn);
    row.addEventListener('focusout', onFocusOut);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      row.removeEventListener('scroll', onScroll);
      row.removeEventListener('pointerenter', onEnter);
      row.removeEventListener('pointerleave', onLeave);
      row.removeEventListener('pointerdown', onTouch);
      row.removeEventListener('focusin', onFocusIn);
      row.removeEventListener('focusout', onFocusOut);
    };
  }, [ref, enabled, count, speed, nested]);
}
