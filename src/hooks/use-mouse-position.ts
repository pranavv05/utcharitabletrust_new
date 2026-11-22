'use client';
import {useEffect, useRef} from 'react';
export function useMousePosition() {
  const position = useRef({x: 0, y: 0});
  useEffect(() => {
    const move = (event: PointerEvent) => {
      position.current = {x: event.clientX, y: event.clientY};
    };
    window.addEventListener('pointermove', move, {passive: true});
    return () => window.removeEventListener('pointermove', move);
  }, []);
  return position;
}
