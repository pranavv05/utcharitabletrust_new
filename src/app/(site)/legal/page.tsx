import type {Metadata} from 'next';
import {PageIntro} from '@/components/shared';
import {LegalLibrary} from '@/components/legal-library';
import {getSiteContent} from '@/lib/site-content';

export const metadata: Metadata = {title: 'Legal documents'};
export const dynamic = 'force-dynamic';

export default async function LegalPage() {
  const {legal, iso} = await getSiteContent();
  return (
    <>
      <PageIntro
        eyebrow="Legal documents"
        title="Built on trust."
        description="Registrations, certifications, annual reports and policies published by UT Charitable Trust."
      />
      <section className="page-content">
        <div className="container">
          <LegalLibrary docs={legal} iso={iso} />
        </div>
      </section>
    </>
  );
}
