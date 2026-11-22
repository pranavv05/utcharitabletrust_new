import type {MetadataRoute} from 'next';
import {getSiteContent} from '@/lib/site-content';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const {programmes, news, legal} = await getSiteContent();
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const routes = [
    '',
    '/about',
    '/our-work',
    '/team',
    '/president-message',
    '/legal',
    '/news',
    '/partners',
    '/testimonials',
    '/interns',
    '/book-bank',
    '/gallery',
    '/contact',
    '/join',
    '/privacy',
    ...programmes.filter((p) => p.slug !== 'book-bank').map((p) => `/our-work/${p.slug}`),
    ...news.map((n) => `/news/${n.slug}`),
    ...legal.filter((d) => d.body).map((d) => `/legal/${d.slug}`),
  ];
  return routes.map((route) => ({
    url: base + route,
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
