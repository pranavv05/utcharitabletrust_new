'use client';
import {createContext, useContext} from 'react';
import type Lenis from 'lenis';
import type {RefObject} from 'react';
export type ScrollContext = {lenis: RefObject<Lenis | null>; scrollTo: (target: string | number) => void};
export const SmoothScrollContext = createContext<ScrollContext | null>(null);
export function useSmoothScroll() {
  const context = useContext(SmoothScrollContext);
  if (!context) throw new Error('useSmoothScroll needs SmoothScroll');
  return context;
}
