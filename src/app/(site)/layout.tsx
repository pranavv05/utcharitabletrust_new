import {TrustAssistant} from '@/components/trust-assistant';
import {PublicTheme} from '@/components/public-theme';
import {getSiteContent} from '@/lib/site-content';
import {SiteContentProvider} from '@/components/site-content-provider';
import {SiteLive} from '@/components/live-updates';
import Link from 'next/link';
import {Header} from '@/components/header';
import {Footer} from '@/components/footer';
import {SmoothScroll} from '@/components/ui/smooth-scroll';
import {ChapterNavigation} from '@/components/ui/chapter-navigation';
import {CustomCursor} from '@/components/ui/custom-cursor';
export const dynamic = 'force-dynamic';
export default async function SiteLayout({children}: {children: React.ReactNode}) {
  const content = await getSiteContent();
  return (
    <SiteContentProvider value={content}>
      <PublicTheme />
      <SiteLive />
      <SmoothScroll>
        <ChapterNavigation />
        <Header />
        <main id="main" className="site-main">
          {content.announcements.length > 0 && (
            <aside className="site-announcements" aria-label="Trust announcements">
              {content.announcements.map((a) => (
                <article key={a.id}>
                  <strong>{a.name}</strong>
                  <p>{a.body}</p>
                  {a.link && <Link href={a.link}>Read more →</Link>}
                </article>
              ))}
            </aside>
          )}
          {children}
        </main>
        <Footer />
        <CustomCursor />
        <TrustAssistant />
      </SmoothScroll>
    </SiteContentProvider>
  );
}
