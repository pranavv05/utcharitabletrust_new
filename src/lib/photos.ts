import catalogue from './photo-catalogue.json';
export type GalleryPhoto = {
  src: string;
  category: string;
  caption: string;
  description: string;
  href: string;
  /** Four-digit year the photograph was taken, when an administrator has set one. */
  year?: string;
};
export const photoCatalogue: GalleryPhoto[] = catalogue;
export function photoDetails(src: string, category: string) {
  const photo = photoCatalogue.find((p) => p.src === src);
  return {
    description:
      photo?.description ||
      'Members, volunteers and families come together through the work of UT Charitable Trust. This photograph is part of our community archive in Silvassa.',
    href: photo?.href || (category === 'Education' ? '/book-bank' : '/about'),
  };
}
export function programmePhotos(slug: string) {
  const href = slug === 'book-bank' ? '/book-bank' : '/our-work/' + slug;
  return photoCatalogue.filter((p) => p.href === href);
}

export const photoCategory = (category: string) => (category === 'Support' ? 'Essential support' : category);

/** The website path of a programme. */
export const programmeHref = (slug: string) => (slug === 'book-bank' ? '/book-bank' : '/our-work/' + slug);
/** Photographs linked to a programme, taken from the managed gallery so their years are included. */
export const photosForProgramme = (gallery: GalleryPhoto[], slug: string) =>
  gallery.filter((photo) => photo.href === programmeHref(slug));
