export const dynamic = 'force-dynamic';
import {TeamDirectory} from '@/components/team-directory';
import {gmailLink} from '@/lib/contact-links';
import {TrustImage} from '@/components/ui/trust-image';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {PageIntro, ProgrammeCards, JoinBanner, Values} from '@/components/shared';
import {getSiteContent} from '@/lib/site-content';
import {OurWorkExplorer} from '@/components/our-work-explorer';
const pages: Record<string, {title: string; eyebrow: string; description: string}> = {
  about: {
    title: 'A community that cares.',
    eyebrow: 'Our story',
    description:
      'Rooted in Silvassa. United by a belief that everyone deserves dignity, opportunity, and a helping hand.',
  },
  'our-work': {
    title: 'Care takes many forms.',
    eyebrow: 'Our work',
    description:
      'From a book in a student’s hands to support for a family, explore the everyday ways we work alongside our community.',
  },
  team: {
    title: 'The people behind the purpose.',
    eyebrow: 'Our people',
    description:
      'Meet the trustees, members, and volunteers who give their time and care to UT Charitable Trust.',
  },
  'president-message': {
    title: 'A shared purpose. A personal commitment.',
    eyebrow: 'From our president',
    description: 'A message from Mr. Pradip Mishra on community, care, and the work that brings us together.',
  },
  privacy: {
    title: 'Your information, treated with care.',
    eyebrow: 'Privacy',
    description: 'How this website handles information you choose to share with the trust.',
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({page}));
}
export async function generateMetadata({params}: {params: Promise<{page: string}>}): Promise<Metadata> {
  const {page} = await params;
  return {title: pages[page]?.eyebrow || 'Page not found'};
}
export default async function ContentPage({params}: {params: Promise<{page: string}>}) {
  const {page} = await params;
  const {team, programmes, gallery} = await getSiteContent();
  const content = pages[page];
  if (!content) notFound();
  return (
    <>
      <PageIntro {...content} />
      <section className="page-content">
        <div className="container">
          {page === 'about' && (
            <>
              <div className="activity-hero">
                <TrustImage src="/images/banner.webp" alt="UT Charitable Trust and the community it serves" />
                <div>
                  <h2>
                    Small acts.
                    <br />
                    <em>Shared possibilities.</em>
                  </h2>
                  <p>
                    UT Charitable Trust works with migrant and low-income families, supporting community
                    development through education, nutrition, health, and practical assistance.
                  </p>
                  <p>
                    Our approach starts with people. By listening to local needs and bringing volunteers
                    together, we help create a supportive environment where families can move forward with
                    dignity.
                  </p>
                  <Link href="/join" className="button">
                    Become part of our community
                  </Link>
                </div>
              </div>
              <div className="trust-story">
                <div className="story-lead">
                  <span className="chapter-tag">WHY WE ARE HERE</span>
                  <h2>
                    Local roots.
                    <br />
                    <em>A wider circle of care.</em>
                  </h2>
                  <p>
                    The trust’s earlier website describes an organisation focused on the lives of internal
                    migrant workers and families with limited incomes. That purpose connects our work: helping
                    people feel seen, supported and able to participate in their community.
                  </p>
                </div>
                <div className="story-chapters">
                  <article>
                    <h3>Supporting the whole family</h3>
                    <p>
                      Education, nutrition and health are closely connected. The trust’s original aims include
                      vocational and life-skills training, counselling and capacity building, alongside
                      practical assistance. The intention is to help families build a more secure and
                      supportive living environment.
                    </p>
                  </article>
                  <article>
                    <h3>Turning purpose into everyday work</h3>
                    <p>
                      The community book bank, blood donation activities and distributions of food, clothing,
                      school supplies, blankets and rain protection put that purpose into practice. The
                      photographic archive also records the trust’s response during the COVID-19 pandemic and
                      the volunteers who supported that work.
                    </p>
                  </article>
                  <article>
                    <h3>Help without barriers</h3>
                    <p>
                      The original trust objectives describe assistance for women, men, children, older
                      people, people with disabilities and others in need. Support is intended to be offered
                      without distinction of caste, colour, creed, sex or religion, with dignity at the centre
                      of every activity.
                    </p>
                  </article>
                  <article>
                    <h3>Contributions with a shared purpose</h3>
                    <p>
                      The trust’s published objectives allow contributions from individuals, institutions and
                      public agencies. They state that trust funds are to be used towards its charitable
                      objects, with no distribution to trustees as profit, interest or dividends.
                    </p>
                  </article>
                </div>
              </div>
              <Values />
            </>
          )}
          {page === 'our-work' && <OurWorkExplorer programmes={programmes} gallery={gallery} />}
          {page === 'team' && <TeamDirectory team={team} />}
          {page === 'president-message' && (
            <div className="president-grid">
              <TrustImage src="/images/pradip.webp" alt="Mr. Pradip Mishra" />
              <div className="prose">
                <h2>Mr. Pradip Mishra</h2>
                <div className="eyebrow">President, UT Charitable Trust</div>
                <p>
                  Our work is guided by a commitment to community respect, good governance, openness, and
                  accountability.
                </p>
                <p>
                  Social development calls for practical thinking and sustained care. Through our programmes,
                  we strive to support livelihoods, education, health, and opportunities for people facing
                  difficult circumstances.
                </p>
                <p>
                  We believe progress grows when people work together. Our members and volunteers bring their
                  time, experience, and dedication to help turn that belief into everyday action.
                </p>
                <p>
                  Thank you for taking the time to understand our work. We welcome everyone who shares our
                  commitment to a stronger and more caring community.
                </p>
                <p>
                  <em>Pradip Mishra</em>
                </p>
                <Link href="/contact" className="text-link">
                  Connect with the trust
                </Link>
              </div>
            </div>
          )}
          {page === 'privacy' && (
            <div className="prose">
              <h2>Information you share</h2>
              <p>
                Contact and membership forms ask for information needed to respond to your enquiry or review
                your application. Library records support book donations, borrowing, returns, and receipts.
              </p>
              <h2>Access and use</h2>
              <p>
                Public visitors can view the book catalogue and published website content. Personal
                submissions and library administration records are restricted to authorised staff. We do not
                display your contact details in the public catalogue.
              </p>
              <h2>Website preferences</h2>
              <p>
                The public website uses a light theme. Staff theme preferences are saved in the browser. Staff
                authentication uses session cookies. No advertising trackers are included in this application.
              </p>
              <h2>Website assistant</h2>
              <p>
                The website assistant uses published trust information. When AI replies are enabled, your chat
                messages and recent conversation are sent to Groq to generate an answer. We do not save chat
                transcripts in the trust database; the current chat stays in page memory until you leave or
                clear it. Avoid sharing private account details or sensitive personal information. AI replies
                can be inaccurate, so confirm arrangements with the trust.
              </p>
              <h2>Contact links and maps</h2>
              <p>
                WhatsApp, Gmail and Google Maps links open those services. The contact page includes a Google
                Maps embed, which connects to Google when loaded. Those services handle information under
                their own policies.
              </p>
              <h2>Your choices</h2>
              <p>
                For questions about your information, or to request a correction or deletion, contact{' '}
                <a className="text-link" href={gmailLink()} target="_blank" rel="noopener noreferrer">
                  help@utcharitabletrust.com
                </a>
                . The trust will review requests in the context of its operational and recordkeeping needs.
              </p>
            </div>
          )}
        </div>
      </section>
      {page !== 'privacy' && <JoinBanner />}
    </>
  );
}
