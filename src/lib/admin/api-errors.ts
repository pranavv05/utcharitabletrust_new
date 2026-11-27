/**
 * Turns a failed request into a sentence an administrator can act on. Servers answer with short technical
 * messages (or with a web page, when something between the browser and the app fails), so the status decides.
 */
export function friendlyError(status: number, message?: unknown): string {
  const text = typeof message === 'string' ? message.trim() : '';
  if (status === 0) return 'Could not reach the server. Check the internet connection and try again.';
  if (status === 401)
    return 'Your sign-in has expired. Sign in again in a new tab, then press the button again. What you typed here is not lost.';
  if (status === 403 && !text) return 'Your account is not allowed to do that.';
  if (status === 413) return text || 'That is too large to send.';
  if (status === 429) return text || 'Too many attempts. Please wait a minute and try again.';
  if (status >= 500 && (!text || /^(internal|error|bad gateway|service)/i.test(text)))
    return 'The server had a problem. Please try again in a moment.';
  return text || 'Something went wrong. Please try again.';
}

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Sends a JSON request and returns the answer, or throws a readable message. If exactly the same request is
 * already on its way (a double click, Enter pressed twice, a slow connection and an impatient second tap), the
 * second call waits for the first answer instead of sending again, so a donation can never be saved twice.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function postJson(url: string, body: unknown): Promise<any> {
  const key = url + ' ' + JSON.stringify(body);
  const running = inFlight.get(key);
  if (running) return running;
  const request = (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
    } catch {
      throw Error(friendlyError(0));
    }
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw Error(friendlyError(response.status, (data as {message?: unknown} | null)?.message));
    return data;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Reads JSON from the server, or throws a readable message. Cancelled requests are passed through untouched. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJson(url: string, init?: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw Error(friendlyError(0));
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw Error(friendlyError(response.status, (data as {message?: unknown} | null)?.message));
  return data;
}
