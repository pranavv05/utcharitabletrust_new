import {PageIntro} from '@/components/shared';
import {RequestForm} from '@/components/request-form';
import {trustContacts, gmailLink, whatsappLink, mapsLink} from '@/lib/contact-links';
import {Phone, Mail, MapPin} from 'lucide-react';
export const metadata = {title: 'Get in touch'};
export default async function ContactPage({searchParams}: {searchParams: Promise<{subject?: string}>}) {
  const {subject} = await searchParams;
  return (
    <>
      <PageIntro
        eyebrow="Get in touch"
        title="Good things start with a conversation."
        description="Have a question, an idea, or a little time to give? Our team would love to hear from you."
      />
      <section className="page-content contact-page">
        <div className="container contact-reference-grid">
          <aside className="contact-reference-aside">
            <div className="contact-talk-card">
              <h2>Prefer to talk?</h2>
              <p>Message us to ask a question or arrange a drop-off.</p>
              <div className="contact-channel">
                <Phone size={21} />
                <div>
                  {[trustContacts.support, trustContacts.events].map((c) => (
                    <a key={c.digits} href={whatsappLink(c.digits)} target="_blank" rel="noopener noreferrer">
                      <strong>{c.number}</strong>
                      <span>{c.label}</span>
                    </a>
                  ))}
                </div>
              </div>
              <div className="contact-channel">
                <Mail size={21} />
                <div>
                  <a href={gmailLink()} target="_blank" rel="noopener noreferrer">
                    <strong>{trustContacts.email}</strong>
                  </a>
                  <a href={gmailLink(trustContacts.secondaryEmail)} target="_blank" rel="noopener noreferrer">
                    {trustContacts.secondaryEmail}
                  </a>
                </div>
              </div>
              <div className="contact-channel">
                <MapPin size={21} />
                <div>
                  <p>
                    Shop No. 05, V-Raj Darshan, Samarwani,
                    <br />
                    Silvassa, Dadra & Nagar Haveli – 396230
                  </p>
                  <a className="contact-directions" href={mapsLink} target="_blank" rel="noopener noreferrer">
                    Get directions
                  </a>
                </div>
              </div>
            </div>
            <div className="contact-map">
              <iframe
                title="Find UT Charitable Trust in Silvassa"
                src={
                  'https://maps.google.com/maps?q=' +
                  encodeURIComponent(trustContacts.address) +
                  '&z=16&output=embed'
                }
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                Open in Maps
              </a>
            </div>
          </aside>
          <RequestForm kind="contact" initialSubject={subject?.slice(0, 120)} />
        </div>
      </section>
    </>
  );
}
