import {FitPhoto} from '@/components/ui/fit-photo';
import {TrustImage} from '@/components/ui/trust-image';
import Link from 'next/link';
import {Heart, BookOpen, Droplets, Utensils, HandHeart, GraduationCap, BadgeCheck} from 'lucide-react';
import {ProgrammeGrid} from '@/components/programme-grid';
import {getSiteContent, type SiteContent} from '@/lib/site-content';
export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="page-intro">
      <div className="container">
        <div className="eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
export {ProgrammeGrid};
export async function ProgrammeCards({limit}: {limit?: number}) {
  const {programmes, gallery} = await getSiteContent();
  return <ProgrammeGrid programmes={programmes} gallery={gallery} limit={limit} />;
}
export async function JoinBanner() {
  const {iso} = await getSiteContent();
  return (
    <section className="editorial-join">
      <div className="container editorial-join-inner" data-reveal>
        <div>
          <p className="section-label">THE NEXT CHAPTER NEEDS YOU</p>
          <h2>
            Good things happen
            <br />
            when we come together.
          </h2>
        </div>
        <div className="editorial-join-actions">
          <p>
            Give your time. Share your skills.
            <br />
            Help us make a difference, close to home.
          </p>
          <Link href="/join" className="button">
            Get involved
          </Link>
          <Link href="/contact" className="editorial-link">
            Let’s talk
          </Link>
          <p className="editorial-iso">
            <BadgeCheck size={16} aria-hidden="true" />{' '}
            {iso ? iso.standard + ' certified' : 'An ISO certified trust'}
          </p>
        </div>
      </div>
    </section>
  );
}
export function Values() {
  return (
    <div className="values-grid">
      {[
        [
          HandHeart,
          'Dignity, always',
          'We believe support begins with listening, respect, and understanding.',
        ],
        [
          GraduationCap,
          'Opportunity for everyone',
          'Education and practical support help people take their next step.',
        ],
        [
          Heart,
          'Community comes first',
          'Our work grows through the care and participation of local people.',
        ],
      ].map(([Icon, title, copy]) => {
        const I = Icon as typeof Heart;
        return (
          <div className="value" key={String(title)}>
            <I size={28} strokeWidth={1.5} />
            <h3>{String(title)}</h3>
            <p>{String(copy)}</p>
          </div>
        );
      })}
    </div>
  );
}
