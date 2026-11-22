import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {PageIntro} from '@/components/shared';
import {getSiteContent} from '@/lib/site-content';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
  const {slug} = await params;
  const doc = (await getSiteContent()).legal.find((d) => d.slug === slug && d.body);
  return {title: doc ? doc.title : 'Document not found'};
}

export default async function PolicyPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const doc = (await getSiteContent()).legal.find((d) => d.slug === slug && d.body);
  if (!doc) notFound();
  const paragraphs = doc.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      <PageIntro
        eyebrow="Legal documents"
        title={doc.title}
        description={doc.issuer ? 'Issued by ' + doc.issuer : ''}
      />
      <section className="page-content">
        <div className="container sx-article">
          <div className="prose">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {doc.file && (
            <p>
              <a className="text-link" href={doc.file} target="_blank" rel="noopener noreferrer">
                Download the full document
              </a>
            </p>
          )}
          <p>
            <Link className="text-link" href="/legal">
              ← All legal documents
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
