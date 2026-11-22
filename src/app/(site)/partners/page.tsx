import type {Metadata} from 'next';
import Link from 'next/link';
import {PageIntro} from '@/components/shared';
import {PartnerCard, sortPartners, tierLabel, tierOrder} from '@/components/partners';
import {getSiteContent} from '@/lib/site-content';

export const metadata: Metadata = {title: 'Our partners'};
export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
  const {partners} = await getSiteContent();
  const sorted = sortPartners(partners);
  return (
    <>
      <PageIntro
        eyebrow="Our partners"
        title="Together, we reach further."
        description="The companies and organisations whose support makes our work possible. Thank you."
      />
      <section className="page-content">
        <div className="container">
          {tierOrder.map((tier) => {
            const group = sorted.filter((p) => p.tier === tier);
            return group.length ? (
              <div key={tier} className="sx-tier">
                <h2>{tierLabel[tier]}</h2>
                <div className={'sx-partner-grid tier-' + tier}>
                  {group.map((p) => (
                    <PartnerCard key={p.id} partner={p} />
                  ))}
                </div>
              </div>
            ) : null;
          })}
          {!partners.length && (
            <p className="gallery-empty">Our partner list is being prepared. Please check back soon.</p>
          )}
          <div className="sx-cta">
            <h2>Support the trust’s work</h2>
            <p>
              Companies of every size can partner with us through donations, books, supplies, volunteering and
              events, and be recognised on this page.
            </p>
            <Link className="button" href="/contact?subject=Partner%20with%20us">
              Partner with us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
