import type {MetadataRoute} from 'next';
import {getSiteContent} from '@/lib/site-content';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const {programmes} = await getSiteContent();
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const routes = [
    '',
    '/about',
    '/our-work',
    '/team',
    '/president-message',
    '/certificates',
    '/book-bank',
    '/gallery',
    '/contact',
    '/join',
    '/privacy',
    ...programmes.filter((p) => p.slug !== 'book-bank').map((p) => `/our-work/${p.slug}`),
  ];
  return routes.map((route) => ({
    url: base + route,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
