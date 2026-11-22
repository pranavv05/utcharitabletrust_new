import type {Metadata} from 'next';
import Link from 'next/link';
import {PageIntro} from '@/components/shared';
import {TestimonialCard} from '@/components/testimonials';
import {getSiteContent} from '@/lib/site-content';

export const metadata: Metadata = {title: 'Testimonials'};
export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  const {testimonials} = await getSiteContent();
  return (
    <>
      <PageIntro
        eyebrow="Testimonials"
        title="In their own words."
        description="Donors, volunteers, families and partners share what the trust’s work means to them."
      />
      <section className="page-content">
        <div className="container">
          {testimonials.length ? (
            <div className="sx-quote-grid">
              {testimonials.map((t) => (
                <TestimonialCard key={t.id} item={t} />
              ))}
            </div>
          ) : (
            <p className="gallery-empty">Testimonials will appear here soon.</p>
          )}
          <div className="sx-cta">
            <h2>Share your story</h2>
            <p>Have you been part of our work? We would love to hear from you.</p>
            <Link className="button" href="/contact">
              Write to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
