import {PageIntro, JoinBanner} from '@/components/shared';
import {Gallery} from '@/components/gallery';
import {getSiteContent} from '@/lib/site-content';
export const metadata = {title: 'Our gallery'};
export default async function GalleryPage() {
  const {gallery} = await getSiteContent();
  return (
    <>
      <PageIntro
        eyebrow="Our gallery"
        title="Real people. Meaningful moments."
        description="A window into our community, our volunteers, and the everyday acts of care that bring us together."
      />
      <section className="page-content">
        <div className="container">
          <Gallery gallery={gallery} />
        </div>
      </section>
      <JoinBanner />
    </>
  );
}
