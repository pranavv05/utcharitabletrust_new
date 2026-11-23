'use client';
import {fitSize} from './photo-batch';

/**
 * Makes a web-sized copy of a photograph in the browser: at most `max` pixels on the longest side,
 * saved as WebP (or JPEG where WebP is unavailable). The original file is never uploaded.
 * Throws a readable message for files the browser cannot decode (for example some HEIC photos).
 */
export async function webSized(file: File, max = 1600, quality = 0.82): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
  } catch {
    throw Error('This photo format is not supported. Save it as JPEG or PNG and try again.');
  }
  try {
    const {width, height} = fitSize(bitmap.width, bitmap.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('The browser could not prepare this photo.');
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = (type: string, q: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
    const webp = await blob('image/webp', quality);
    const out = webp && webp.type === 'image/webp' ? webp : await blob('image/jpeg', quality);
    if (!out) throw Error('The browser could not prepare this photo.');
    const extension = out.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([out], file.name.replace(/\.[^.]+$/, '') + '.' + extension, {type: out.type});
  } finally {
    bitmap.close();
  }
}
