import type {Metadata} from 'next';
import Link from 'next/link';
import {GraduationCap, School} from 'lucide-react';
import {PageIntro} from '@/components/shared';
import {getSiteContent} from '@/lib/site-content';

export const metadata: Metadata = {title: 'Our interns'};
export const dynamic = 'force-dynamic';

export default async function InternsPage() {
  const {colleges} = await getSiteContent();
  const sorted = colleges.toSorted((a, b) => b.interns - a.interns || a.name.localeCompare(b.name));
  const total = colleges.reduce((sum, c) => sum + c.interns, 0);
  return (
    <>
      <PageIntro
        eyebrow="Our interns"
        title="Young people, real experience."
        description="Students from colleges across the region join the trust to learn, contribute and grow with our community."
      />
      <section className="page-content">
        <div className="container">
          {colleges.length > 0 ? (
            <>
              <div className="sx-stats">
                <p>
                  <GraduationCap size={26} aria-hidden="true" />
                  <strong>{total.toLocaleString('en-IN')}</strong> interns so far
                </p>
                <p>
                  <School size={26} aria-hidden="true" />
                  <strong>{colleges.length}</strong> {colleges.length === 1 ? 'college' : 'colleges'}
                </p>
              </div>
              <div className="sx-college-grid">
                {sorted.map((college) => (
                  <article key={college.id} className="sx-college">
                    {college.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={college.logo} alt={college.name + ' logo'} loading="lazy" />
                    )}
                    <h3>{college.name}</h3>
                    {college.city && <p className="sx-meta">{college.city}</p>}
                    <p className="sx-college-count">
                      <strong>{college.interns.toLocaleString('en-IN')}</strong>{' '}
                      {college.interns === 1 ? 'intern' : 'interns'}
                      {college.period ? ' · ' + college.period : ''}
                    </p>
                    {college.note && <p>{college.note}</p>}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="gallery-empty">Our intern colleges will be listed here soon.</p>
          )}
          <div className="sx-cta">
            <h2>Interested in interning with us?</h2>
            <p>Tell us about your college, your interests and the time you can offer.</p>
            <Link className="button" href="/contact?subject=Volunteer">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
