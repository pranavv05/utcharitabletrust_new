/** Rules for PDFs and videos, which are uploaded straight to storage with a signed link. */
export const largeUploads = {
  'application/pdf': {ext: 'pdf', max: 20 * 1024 * 1024, label: 'PDF up to 20 MB'},
  'video/mp4': {ext: 'mp4', max: 50 * 1024 * 1024, label: 'MP4 video up to 50 MB'},
  'video/webm': {ext: 'webm', max: 50 * 1024 * 1024, label: 'WebM video up to 50 MB'},
} as const;

export type LargeType = keyof typeof largeUploads;

export function validateLargeUpload(
  type: unknown,
  size: unknown,
): {ok: true; ext: string; type: LargeType} | {ok: false; message: string} {
  if (typeof type !== 'string' || !Object.hasOwn(largeUploads, type))
    return {ok: false, message: 'Upload a PDF, MP4 or WebM file.'};
  const rule = largeUploads[type as LargeType];
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)
    return {ok: false, message: 'The file looks empty.'};
  if (size > rule.max) return {ok: false, message: `That file is too large (${rule.label}).`};
  return {ok: true, ext: rule.ext, type: type as LargeType};
}
