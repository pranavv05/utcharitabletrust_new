export type Limiter = {
  /** Records one hit and returns whether it is allowed plus seconds until the window resets. */
  hit(key: string): {allowed: boolean; retryAfter: number};
  /** Returns whether the key is already over its limit without recording a hit. */
  blocked(key: string): {blocked: boolean; retryAfter: number};
  reset(key: string): void;
};

/**
 * Fixed-window in-memory limiter. It is per server instance: on serverless or multi-instance
 * deployments it only slows abuse down, so pair it with database or edge limits.
 */
export function createLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): Limiter {
  const entries = new Map<string, {count: number; until: number}>();
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 5000;
  function sweep(time: number) {
    for (const [key, value] of entries) if (value.until <= time) entries.delete(key);
  }
  function current(key: string, time: number) {
    const entry = entries.get(key);
    return entry && entry.until > time ? entry : undefined;
  }
  return {
    hit(key) {
      const time = now();
      if (entries.size >= maxKeys) sweep(time);
      const entry = current(key, time);
      if (!entry) {
        // When the table is full of live keys, fail closed rather than grow without bound.
        if (entries.size >= maxKeys) return {allowed: false, retryAfter: Math.ceil(options.windowMs / 1000)};
        entries.set(key, {count: 1, until: time + options.windowMs});
        return {allowed: true, retryAfter: 0};
      }
      entry.count += 1;
      return {
        allowed: entry.count <= options.limit,
        retryAfter: Math.max(1, Math.ceil((entry.until - time) / 1000)),
      };
    },
    blocked(key) {
      const time = now();
      const entry = current(key, time);
      return entry && entry.count >= options.limit
        ? {blocked: true, retryAfter: Math.max(1, Math.ceil((entry.until - time) / 1000))}
        : {blocked: false, retryAfter: 0};
    },
    reset(key) {
      entries.delete(key);
    },
  };
}
