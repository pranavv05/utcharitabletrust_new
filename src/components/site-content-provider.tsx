'use client';
import {createContext, useContext} from 'react';
import type {IsoInfo} from '@/lib/site-content';

/**
 * The few facts that small client components (the header, hero and numbers strip) need on every page.
 * Keep this tiny: everything in it is sent to the browser with every page. Larger lists, such as the
 * gallery, are fetched by the page that shows them and passed down as props.
 */
export type ClientContent = {iso: IsoInfo | null; programmeCount: number};
const Content = createContext<ClientContent | null>(null);
export function SiteContentProvider({value, children}: {value: ClientContent; children: React.ReactNode}) {
  return <Content.Provider value={value}>{children}</Content.Provider>;
}
export function useSiteContent() {
  const content = useContext(Content);
  if (!content) throw Error('Website content provider is missing');
  return content;
}
