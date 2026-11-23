import {cache} from 'react';
import {serverClient} from '@/lib/supabase/server';
import {programmes, gallery, isContentNotDeployed} from '@/lib/content';
import team from '@/lib/team.json';
import {photoDetails, photoCategory} from './photos';
import {photoList, yearOf} from './media';
import {normalizeGroup, type TeamGroup} from './team';

export type TeamMember = {name: string; role: string; image: string; group: TeamGroup; bio?: string};
export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  date: string;
  year: string;
  category: string;
  summary: string;
  body: string;
  image: string;
  photos: string[];
  videoUrl: string;
  videoFile: string;
};
export type Testimonial = {
  id: string;
  name: string;
  quote: string;
  role: string;
  image: string;
  videoUrl: string;
  featured: boolean;
};
export type StudentVoice = {
  id: string;
  name: string;
  quote: string;
  role: string;
  year: string;
  image: string;
  videoUrl: string;
  videoFile: string;
  featured: boolean;
};
export type PartnerTier = 'principal' | 'gold' | 'silver' | 'supporter';
export type Partner = {
  id: string;
  slug: string;
  name: string;
  tier: PartnerTier;
  logo: string;
  website: string;
  description: string;
  since: string;
};
export type LegalGroup = 'registration' | 'report' | 'policy' | 'certification' | 'other';
export type LegalDoc = {
  id: string;
  slug: string;
  title: string;
  group: LegalGroup;
  number: string;
  issued: string;
  validUntil: string;
  issuer: string;
  file: string;
  image: string;
  body: string;
  year: string;
};
export type College = {
  id: string;
  name: string;
  city: string;
  logo: string;
  interns: number;
  period: string;
  note: string;
};
export type IsoInfo = {
  standard: string;
  certificateNo: string;
  issuer: string;
  validUntil: string;
  image: string;
  link: string;
  note: string;
};
export type SiteContent = {
  programmes: typeof programmes;
  gallery: typeof gallery;
  team: TeamMember[];
  announcements: {id: string; name: string; body: string; link: string}[];
  news: NewsItem[];
  testimonials: Testimonial[];
  studentVoices: StudentVoice[];
  partners: Partner[];
  legal: LegalDoc[];
  colleges: College[];
  iso: IsoInfo | null;
};
export type Entry = {id: string; kind: string; slug: string; name: string; data: Record<string, string>};

const tiers: PartnerTier[] = ['principal', 'gold', 'silver', 'supporter'];
const groups: LegalGroup[] = ['registration', 'report', 'policy', 'certification', 'other'];
const certificates = [1, 2, 4, 5];

/** The bundled content shown when no database is configured. */
export const fallbackContent: SiteContent = {
  programmes,
  gallery,
  team: (team as {name: string; role: string; image: string; group: string}[]).map((m) => ({
    ...m,
    group: normalizeGroup(m.group),
  })),
  announcements: [],
  news: [],
  testimonials: [],
  studentVoices: [],
  partners: [],
  legal: certificates.map((n, i) => ({
    id: 'certificate-' + n,
    slug: 'trust-certificate-' + (i + 1),
    title: 'Trust certificate ' + (i + 1),
    group: 'registration',
    number: '',
    issued: '',
    validUntil: '',
    issuer: '',
    file: `/images/cert/cert${n}.webp`,
    image: `/images/cert/cert${n}.webp`,
    body: '',
    year: '',
  })),
  colleges: [],
  iso: null,
};

/** Turns the published rows from the database into the shapes the public pages use. */
export function mapContent(rows: Entry[]): SiteContent {
  const of = (kind: string) => rows.filter((r) => r.kind === kind);
  const iso = of('setting').find((r) => r.data.standard);
  return {
    programmes: of('programme').map((r) => ({
      slug: r.slug,
      name: r.name,
      title: r.data.title || r.name,
      category: r.data.category || 'Community',
      description: r.data.description || '',
      body: r.data.body || '',
      image: r.data.image,
      color: ['blue', 'red', 'green', 'yellow'].includes(r.data.color) ? r.data.color : 'blue',
    })),
    gallery: of('gallery').map((r) => ({
      src: r.data.image,
      category: photoCategory(r.data.category || 'Community'),
      caption: r.name,
      description: r.data.description || photoDetails(r.data.image, r.data.category).description,
      href: r.data.link || photoDetails(r.data.image, r.data.category).href,
      year: yearOf(r.data.year),
    })),
    team: of('team').map((r) => ({
      name: r.name,
      role: r.data.role || '',
      image: r.data.image,
      group: normalizeGroup(r.data.group),
      ...(r.data.bio ? {bio: r.data.bio} : {}),
    })),
    announcements: of('announcement').map((r) => ({
      id: r.id,
      name: r.name,
      body: r.data.body || '',
      link: r.data.link || '',
    })),
    news: of('news').map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.name,
      date: r.data.date || '',
      year: yearOf(r.data.date),
      category: r.data.category || 'News',
      summary: r.data.summary || '',
      body: r.data.body || '',
      image: r.data.image || '',
      photos: photoList(r.data.photos),
      videoUrl: r.data.video_url || '',
      videoFile: r.data.video_file || '',
    })),
    testimonials: of('testimonial').map((r) => ({
      id: r.id,
      name: r.name,
      quote: r.data.quote || '',
      role: r.data.role || '',
      image: r.data.image || '',
      videoUrl: r.data.video_url || '',
      featured: r.data.featured === 'yes',
    })),
    studentVoices: of('student_voice').map((r) => ({
      id: r.id,
      name: r.name,
      quote: r.data.quote || '',
      role: r.data.role || '',
      year: yearOf(r.data.year),
      image: r.data.image || '',
      videoUrl: r.data.video_url || '',
      videoFile: r.data.video_file || '',
      featured: r.data.featured === 'yes',
    })),
    partners: of('partner').map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tier: (tiers as string[]).includes(r.data.tier) ? (r.data.tier as PartnerTier) : 'supporter',
      logo: r.data.logo || '',
      website: r.data.website || '',
      description: r.data.description || '',
      since: r.data.since || '',
    })),
    legal: of('legal').map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.name,
      group: (groups as string[]).includes(r.data.group) ? (r.data.group as LegalGroup) : 'other',
      number: r.data.number || '',
      issued: r.data.issued || '',
      validUntil: r.data.valid_until || '',
      issuer: r.data.issuer || '',
      file: r.data.file || '',
      image: r.data.image || '',
      body: r.data.body || '',
      year: r.data.year || yearOf(r.data.issued),
    })),
    colleges: of('college').map((r) => ({
      id: r.id,
      name: r.name,
      city: r.data.city || '',
      logo: r.data.logo || '',
      interns: Number(r.data.interns) || 0,
      period: r.data.period || '',
      note: r.data.note || '',
    })),
    iso: iso
      ? {
          standard: iso.data.standard,
          certificateNo: iso.data.certificate_no || '',
          issuer: iso.data.issuer || '',
          validUntil: iso.data.valid_until || '',
          image: iso.data.image || '',
          link: iso.data.link || '',
          note: iso.data.note || '',
        }
      : null,
  };
}

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const db = await serverClient();
  if (!db) return fallbackContent;
  const {data, error} = await db.rpc('website_content');
  if (isContentNotDeployed(error)) {
    // The CMS migrations are not applied: serve the bundled content instead of an error page.
    console.error('website_content() is missing; serving bundled content. Apply the Supabase migrations.');
    return fallbackContent;
  }
  if (error || !Array.isArray(data)) throw Error('Published website content is temporarily unavailable.');
  return mapContent(data as Entry[]);
});

/** How many books have been issued to students, or null when it is not available (nothing is shown then). */
export const getBookStats = cache(async (): Promise<{issued: number} | null> => {
  const db = await serverClient();
  if (!db) return null;
  const {data, error} = await db.rpc('public_book_stats');
  const issued = (data as {issued?: unknown} | null)?.issued;
  if (error || typeof issued !== 'number' || issued < 1) return null;
  return {issued};
});
