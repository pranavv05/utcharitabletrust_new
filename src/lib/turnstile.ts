export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * Verifies a Cloudflare Turnstile token. When no secret key is configured the check is skipped
 * so local development and deployments without Turnstile keep working.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({secret, response: token});
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const result = (await response.json()) as {success?: boolean};
    return result.success === true;
  } catch {
    return false;
  }
}
