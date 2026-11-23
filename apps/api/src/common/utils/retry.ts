/** Runs `fn`, retrying transient failures with exponential backoff and jitter. */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { retries: number; baseMs?: number; isRetryable?: (err: unknown) => boolean },
): Promise<T> {
  const base = opts.baseMs ?? 500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const retryable = opts.isRetryable ? opts.isRetryable(err) : true;
      if (!retryable || attempt === opts.retries) break;
      const delay = base * 2 ** attempt + Math.floor(Math.random() * base);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Rejects if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    }),
  ]);
}
