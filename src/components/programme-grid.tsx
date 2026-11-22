import Link from 'next/link';
import {BookOpen, Droplets, Utensils, HandHeart} from 'lucide-react';
import {FitPhoto} from '@/components/ui/fit-photo';
import {TrustImage} from '@/components/ui/trust-image';
import {photosForProgramme, programmeHref} from '@/lib/photos';
import type {SiteContent} from '@/lib/site-content';

export function ProgrammeGrid({
  programmes,
  gallery,
  limit,
}: {
  programmes: SiteContent['programmes'];
  gallery: SiteContent['gallery'];
  limit?: number;
}) {
  return (
    <div className="programme-grid">
      {programmes.slice(0, limit).map((p, i) => (
        <Link href={programmeHref(p.slug)} className="programme-card" key={p.slug}>
          <div className="programme-photo">
            <FitPhoto
              src={p.image}
              alt={p.name + ' activity by UT Charitable Trust'}
              sizes="(max-width:700px) 100vw,(max-width:1100px) 50vw,33vw"
              loading="lazy"
            />
          </div>
          <div className="programme-preview-strip" aria-hidden="true">
            {photosForProgramme(gallery, p.slug)
              .filter((photo) => photo.src !== p.image)
              .slice(0, 3)
              .map((photo) => (
                <TrustImage key={photo.src} src={photo.src} alt="" loading="lazy" sizes="15vw" />
              ))}
          </div>
          <div className="programme-body">
            <div className="programme-icon">
              {i === 0 ? (
                <BookOpen size={21} />
              ) : i === 1 ? (
                <Droplets size={21} />
              ) : i === 2 ? (
                <Utensils size={21} />
              ) : (
                <HandHeart size={21} />
              )}
            </div>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <span className="text-link">Explore the programme</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
