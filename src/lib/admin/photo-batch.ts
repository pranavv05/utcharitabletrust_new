/** Helpers for adding many photographs to the gallery at once. */

const imageExtension = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i;
const cameraName =
  /^(img|dsc|dscn|dscf|pxl|mvimg|image|photo|pic|screenshot|whatsapp image|wa)[\s_-]*[\d\s_.-]*(at[\s\d._-]*(am|pm)?)?$/i;

/** A readable caption from a file name: "blood-camp_2024.jpg" becomes "Blood camp 2024". */
export function captionFromFilename(filename: string): string {
  const base = filename
    .replace(/^.*[\\/]/, '')
    .replace(imageExtension, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const letters = (base.match(/[A-Za-zऀ-ॿ]/g) || []).length;
  // Camera and phone names such as IMG_20240315_101500 say nothing, so use a neutral caption to edit later.
  if (letters < 4 || cameraName.test(base)) return 'Photograph';
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 150);
}

/** Scales a size down to fit within `max` pixels on its longest side, never up. */
export function fitSize(width: number, height: number, max = 1600): {width: number; height: number} {
  const scale = Math.min(1, max / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

/** A unique, URL-safe slug for a photograph so many with the same caption can coexist. */
export function photoSlug(caption: string, token: string): string {
  const base = caption
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
  return (
    (base || 'photograph') +
    '-' +
    token
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8)
  );
}

/** Only real image files are processed; everything else in a dropped selection is skipped. */
export const isImageFile = (file: {name: string; type: string}) =>
  file.type.startsWith('image/') || imageExtension.test(file.name);
