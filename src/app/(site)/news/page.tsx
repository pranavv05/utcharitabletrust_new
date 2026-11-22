import type {Metadata} from 'next';
import {PageIntro} from '@/components/shared';
import {NewsList} from '@/components/news-list';
import {getSiteContent} from '@/lib/site-content';

export const metadata: Metadata = {title: 'News & Media'};
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const {news} = await getSiteContent();
  return (
    <>
      <PageIntro
        eyebrow="News & Media"
        title="Stories from our community."
        description="Events, press coverage, photographs and videos from the trust’s work in Silvassa."
      />
      <section className="page-content">
        <div className="container">
          <NewsList news={news} />
        </div>
      </section>
    </>
  );
}
