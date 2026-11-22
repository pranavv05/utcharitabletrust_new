'use client';
import Link from 'next/link';
import {useMemo, useState} from 'react';
import {BadgeCheck, FileText, Download} from 'lucide-react';
import {YearFilter} from '@/components/year-filter';
import {byYear, monthYear, yearsOf, type YearFilter as YearValue} from '@/lib/media';
import type {IsoInfo, LegalDoc, LegalGroup} from '@/lib/site-content';

const sections: {group: LegalGroup; id: string; title: string; intro: string}[] = [
  {
    group: 'registration',
    id: 'registration',
    title: 'Registration & tax certificates',
    intro: 'Official registrations and approvals held by the trust.',
  },
  {
    group: 'certification',
    id: 'certifications',
    title: 'Certifications',
    intro: 'Independent certifications of the trust’s processes.',
  },
  {
    group: 'report',
    id: 'reports',
    title: 'Annual reports & accounts',
    intro: 'Year-wise reports and audited accounts.',
  },
  {group: 'policy', id: 'policies', title: 'Policies', intro: 'How the trust works and handles information.'},
  {group: 'other', id: 'other', title: 'Other documents', intro: ''},
];

const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);

function DocumentCard({doc}: {doc: LegalDoc}) {
  const href = doc.file || (doc.body ? '/legal/' + doc.slug : '');
  const external = Boolean(doc.file);
  return (
    <article className="sx-doc">
      {doc.image && !isPdf(doc.image) ? (
        <a
          className="sx-doc-preview"
          href={href || doc.image}
          target={external ? '_blank' : undefined}
          rel="noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.image} alt={'Preview of ' + doc.title} loading="lazy" />
        </a>
      ) : (
        <span className="sx-doc-icon" aria-hidden="true">
          <FileText size={30} />
        </span>
      )}
      <div>
        <h3>{doc.title}</h3>
        <ul className="sx-doc-facts">
          {doc.number && <li>No. {doc.number}</li>}
          {doc.issuer && <li>Issued by {doc.issuer}</li>}
          {doc.issued && <li>Issued {monthYear(doc.issued)}</li>}
          {doc.validUntil && <li>Valid until {monthYear(doc.validUntil)}</li>}
          {doc.year && doc.group === 'report' && <li>Year {doc.year}</li>}
        </ul>
        {href &&
          (external ? (
            <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
              {isPdf(href) ? (
                <>
                  <Download size={14} aria-hidden="true" /> Download PDF
                </>
              ) : (
                'View full document'
              )}
            </a>
          ) : (
            <Link className="text-link" href={href}>
              Read the policy
            </Link>
          ))}
      </div>
    </article>
  );
}

export function LegalLibrary({docs, iso}: {docs: LegalDoc[]; iso: IsoInfo | null}) {
  const [year, setYear] = useState<YearValue>('all');
  const reports = useMemo(() => docs.filter((d) => d.group === 'report'), [docs]);
  const reportYears = useMemo(() => yearsOf(reports), [reports]);
  return (
    <>
      {iso && (
        <section id="certification" className="sx-iso-card" aria-labelledby="iso-title">
          <BadgeCheck size={36} aria-hidden="true" />
          <div>
            <h2 id="iso-title">{iso.standard} certified</h2>
            <p>
              UT Charitable Trust is certified to <strong>{iso.standard}</strong>
              {iso.issuer ? ` by ${iso.issuer}` : ''}.
            </p>
            <ul className="sx-doc-facts">
              {iso.certificateNo && <li>Certificate no. {iso.certificateNo}</li>}
              {iso.validUntil && <li>Valid until {monthYear(iso.validUntil)}</li>}
            </ul>
            {iso.note && <p>{iso.note}</p>}
            {iso.link && (
              <a
                className="text-link"
                href={iso.link}
                target={iso.link.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                View the certificate
              </a>
            )}
          </div>
          {iso.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iso.image} alt={iso.standard + ' certificate'} loading="lazy" />
          )}
        </section>
      )}
      {sections.map((section) => {
        const list =
          section.group === 'report' ? byYear(reports, year) : docs.filter((d) => d.group === section.group);
        if (!docs.some((d) => d.group === section.group)) return null;
        return (
          <section
            key={section.group}
            id={section.id}
            className="sx-legal-section"
            aria-labelledby={section.id + '-title'}
          >
            <h2 id={section.id + '-title'}>{section.title}</h2>
            {section.intro && <p className="sx-intro">{section.intro}</p>}
            {section.group === 'report' && (
              <YearFilter
                years={reportYears}
                value={year}
                hasUndated={reports.some((d) => !d.year)}
                onChange={setYear}
                label="Filter reports by year"
              />
            )}
            <div className="sx-doc-grid">
              {list
                .toSorted((a, b) => (section.group === 'report' ? b.year.localeCompare(a.year) : 0))
                .map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} />
                ))}
            </div>
            {!list.length && <p className="gallery-empty">No documents for this year.</p>}
          </section>
        );
      })}
      {!docs.length && !iso && <p className="gallery-empty">Documents will be published here soon.</p>}
    </>
  );
}
