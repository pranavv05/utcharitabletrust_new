/**
 * Best-effort client address for rate limiting.
 * Prefers headers set by the hosting edge (which clients cannot forge), then falls back to the
 * right-most X-Forwarded-For entry, which is the one appended by our nearest proxy.
 * The left-most entry is client-controlled and must not be trusted.
 */
export function clientIp(headers: Pick<Headers, 'get'>): string {
  for (const name of ['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-real-ip']) {
    const value = headers.get(name)?.split(',')[0]?.trim();
    if (value) return value.slice(0, 64);
  }
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.length ? forwarded[forwarded.length - 1].slice(0, 64) : 'unknown';
}
