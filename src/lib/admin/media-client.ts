'use client';
import {browserClient} from '@/lib/supabase/browser';
import {largeUploads, validateLargeUpload} from './media-upload';
import {webSized} from './image-resize';
import {prepareVideo} from './video-shrink';

/**
 * Uploads a JPEG, PNG or WebP photograph and returns its public URL. Phone and camera photos are often 5-12 MB,
 * so anything over 1.5 MB is first shrunk in the browser to a web-sized copy (the original is never needed).
 */
export async function uploadImage(file: File): Promise<string> {
  if (file.size === 0) throw Error('That file is empty.');
  if (file.size > 1.5 * 1024 * 1024) file = await webSized(file, 2000, 0.85);
  if (file.size > 5 * 1024 * 1024)
    throw Error('That photo is still over 5 MB after shrinking. Try a smaller photo.');
  const form = new FormData();
  form.set('file', file);
  const response = await fetch('/api/admin-media', {method: 'POST', body: form});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.message || 'Upload failed.');
  return data.url as string;
}

/**
 * Uploads a PDF, MP4 or WebM straight to storage using a one-time signed link and returns its public URL.
 * A video over 50 MB is first shrunk in the browser (`onShrink` reports how far that has got, 0 to 1).
 */
export async function uploadLarge(file: File, onShrink?: (fraction: number) => void): Promise<string> {
  if (file.type.startsWith('video/')) file = await prepareVideo(file, onShrink);
  const check = validateLargeUpload(file.type, file.size);
  if (!check.ok) throw Error(check.message);
  const signed = await fetch('/api/admin-media/sign', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({type: file.type, size: file.size}),
  });
  const data = await signed.json().catch(() => ({}));
  if (!signed.ok) throw Error(data.message || 'Upload is not available.');
  const client = browserClient();
  if (!client) throw Error('Uploads need the Supabase settings to be configured.');
  const {error} = await client.storage.from('trust-media').uploadToSignedUrl(data.path, data.token, file, {
    contentType: data.contentType,
  });
  if (error) throw Error('The upload failed. Please try again.');
  return data.publicUrl as string;
}

export const uploadHelp = {
  image: 'JPEG, PNG or WebP. Large photos are shrunk automatically.',
  file: `PDF (${largeUploads['application/pdf'].label}) or a JPEG, PNG or WebP image (large photos are shrunk automatically).`,
  video:
    'MP4 or WebM. Videos over 50 MB are shrunk automatically before upload (keep the screen on while it works). For very long videos, paste a YouTube or Vimeo link instead.',
};
