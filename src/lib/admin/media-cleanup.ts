/** Finding the uploaded files that belong to a deleted piece of website content. */

const mediaKeys = ['image', 'logo', 'file', 'video_file', 'photos'];

/** Storage object paths (inside the trust-media bucket) referenced by one record's data. */
export function mediaPaths(data: Record<string, unknown> | null | undefined, publicBase: string): string[] {
  if (!data || !publicBase) return [];
  const base = publicBase.replace(/\/$/, '') + '/storage/v1/object/public/trust-media/';
  const found = new Set<string>();
  for (const key of mediaKeys) {
    const value = data[key];
    if (typeof value !== 'string') continue;
    for (const line of value.split('\n')) {
      const url = line.trim();
      if (url.startsWith(base)) {
        const path = decodeURIComponent(url.slice(base.length).split('?')[0]);
        if (path && !path.includes('..')) found.add(path);
      }
    }
  }
  return [...found];
}

/** Files from the deleted record that no remaining record still uses. */
export function orphanedPaths(
  deleted: Record<string, unknown> | null | undefined,
  remaining: (Record<string, unknown> | null | undefined)[],
  publicBase: string,
): string[] {
  const stillUsed = new Set(remaining.flatMap((data) => mediaPaths(data, publicBase)));
  return mediaPaths(deleted, publicBase).filter((path) => !stillUsed.has(path));
}
