import Link from 'next/link';
import {TrustImage} from '@/components/ui/trust-image';
import {VideoEmbed} from '@/components/video-embed';
import {getSiteContent, type Testimonial} from '@/lib/site-content';

export function TestimonialCard({item}: {item: Testimonial}) {
  return (
    <figure className="sx-quote">
      {item.videoUrl && (
        <VideoEmbed url={item.videoUrl} title={'Video from ' + item.name} poster={item.image} />
      )}
      <blockquote>
        <p>{item.quote}</p>
      </blockquote>
      <figcaption>
        {item.image && !item.videoUrl && (
          <TrustImage
            className="sx-avatar"
            src={item.image}
            alt=""
            width={96}
            height={96}
            sizes="48px"
            loading="lazy"
          />
        )}
        <span>
          <strong>{item.name}</strong>
          {item.role && <small>{item.role}</small>}
        </span>
      </figcaption>
    </figure>
  );
}

/** Featured testimonials for the home page. Renders nothing until at least one exists. */
export async function TestimonialsSection() {
  const {testimonials} = await getSiteContent();
  const featured = testimonials.filter((t) => t.featured);
  const shown = (featured.length ? featured : testimonials).slice(0, 3);
  if (!shown.length) return null;
  return (
    <section className="sx-testimonials" aria-labelledby="testimonials-title">
      <div className="experience-container">
        <span className="chapter-tag">IN THEIR WORDS</span>
        <div className="sx-strip-head">
          <h2 id="testimonials-title">
            Voices from our <em>community.</em>
          </h2>
          {testimonials.length > shown.length && (
            <Link href="/testimonials" className="text-link">
              Read more stories →
            </Link>
          )}
        </div>
        <div className="sx-quote-grid">
          {shown.map((t) => (
            <TestimonialCard key={t.id} item={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
