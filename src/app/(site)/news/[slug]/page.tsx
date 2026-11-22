import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {PageIntro} from '@/components/shared';
import {TrustImage} from '@/components/ui/trust-image';
import {VideoEmbed} from '@/components/video-embed';
import {getSiteContent} from '@/lib/site-content';
import {monthYear} from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
  const {slug} = await params;
  const item = (await getSiteContent()).news.find((n) => n.slug === slug);
  return item
    ? {
        title: item.title,
        description: item.summary || undefined,
        openGraph: item.image ? {images: [{url: item.image}]} : undefined,
      }
    : {title: 'Story not found'};
}

export default async function NewsStory({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const {news} = await getSiteContent();
  const item = news.find((n) => n.slug === slug);
  if (!item) notFound();
  const paragraphs = item.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hasVideo = Boolean(item.videoUrl || item.videoFile);
  return (
    <>
      <PageIntro
        eyebrow={item.category + (item.date ? ' · ' + monthYear(item.date) : '')}
        title={item.title}
        description={item.summary}
      />
      <section className="page-content">
        <div className="container sx-article">
          {item.image && !hasVideo && (
            <div className="sx-article-cover">
              <TrustImage
                src={item.image}
                alt={item.title}
                sizes="(max-width: 900px) 100vw, 880px"
                priority
              />
            </div>
          )}
          {hasVideo && (
            <VideoEmbed url={item.videoUrl} file={item.videoFile} title={item.title} poster={item.image} />
          )}
          <div className="prose">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {item.photos.length > 0 && (
            <div className="sx-photo-grid" aria-label="More photographs">
              {item.photos.map((src) => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                  <TrustImage src={src} alt="" sizes="(max-width:700px) 50vw,280px" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          <p>
            <Link href="/news" className="text-link">
              ← Back to News & Media
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
