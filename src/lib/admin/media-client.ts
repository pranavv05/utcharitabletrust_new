'use client';
import {browserClient} from '@/lib/supabase/browser';
import {largeUploads, validateLargeUpload} from './media-upload';
import {prepareVideo} from './video-shrink';

/** Uploads a JPEG, PNG or WebP photograph (up to 5 MB) and returns its public URL. */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw Error('Image must be under 5 MB.');
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
  image: 'JPEG, PNG or WebP, up to 5 MB.',
  file: `PDF (${largeUploads['application/pdf'].label}) or a JPEG, PNG or WebP image up to 5 MB.`,
  video:
    'MP4 or WebM. Videos over 50 MB are shrunk automatically before upload (Chrome or Edge on a computer). For very long videos, paste a YouTube or Vimeo link instead.',
};
