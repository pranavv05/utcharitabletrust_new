'use client';
import {createContext, useContext} from 'react';
import type {SiteContent} from '@/lib/site-content';
const Content = createContext<SiteContent | null>(null);
export function SiteContentProvider({value, children}: {value: SiteContent; children: React.ReactNode}) {
  return <Content.Provider value={value}>{children}</Content.Provider>;
}
export function useSiteContent() {
  const content = useContext(Content);
  if (!content) throw Error('Website content provider is missing');
  return content;
}
