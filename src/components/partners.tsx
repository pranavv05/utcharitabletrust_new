import Link from 'next/link';
import {ExternalLink} from 'lucide-react';
import {getSiteContent, type Partner, type PartnerTier} from '@/lib/site-content';

export const tierOrder: PartnerTier[] = ['principal', 'gold', 'silver', 'supporter'];
export const tierLabel: Record<PartnerTier, string> = {
  principal: 'Principal partners',
  gold: 'Gold partners',
  silver: 'Silver partners',
  supporter: 'Supporters',
};

/** Partners sorted by level first, then in the order the administrator arranged them. */
export function sortPartners(partners: Partner[]) {
  return partners.toSorted((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));
}

function Logo({partner, size}: {partner: Partner; size: 'small' | 'large'}) {
  return partner.logo ? (
    // Logos come in every shape, so they are shown whole inside a fixed frame.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={'sx-logo ' + size} src={partner.logo} alt={partner.name + ' logo'} loading="lazy" />
  ) : (
    <span className="sx-logo-text">{partner.name}</span>
  );
}

/** A quiet row of partner logos for the home page. */
export async function PartnersStrip() {
  const {partners} = await getSiteContent();
  if (!partners.length) return null;
  const sorted = sortPartners(partners);
  return (
    <section className="sx-strip" aria-labelledby="partners-strip-title">
      <div className="experience-container">
        <div className="sx-strip-head">
          <h2 id="partners-strip-title">With the support of</h2>
          <Link href="/partners" className="text-link">
            All our partners →
          </Link>
        </div>
        <ul className="sx-strip-logos">
          {sorted.map((partner) => (
            <li key={partner.id}>
              {partner.website ? (
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={partner.name}
                >
                  <Logo partner={partner} size="small" />
                </a>
              ) : (
                <Logo partner={partner} size="small" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PartnerCard({partner}: {partner: Partner}) {
  return (
    <article className={'sx-partner tier-' + partner.tier}>
      <div className="sx-partner-logo">
        <Logo partner={partner} size="large" />
      </div>
      <h3>{partner.name}</h3>
      {partner.since && <p className="sx-meta">Supporting since {partner.since}</p>}
      {partner.description && <p>{partner.description}</p>}
      {partner.website && (
        <a
          className="text-link"
          href={partner.website}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={'Visit the website of ' + partner.name}
        >
          Visit website <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
    </article>
  );
}
