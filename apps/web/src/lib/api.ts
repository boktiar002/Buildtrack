/**
 * The single way the web app talks to the API.
 *  - Same-origin requests (cookies are sent automatically).
 *  - A timeout on every request, so the UI never hangs forever.
 *  - When the 15-minute access token expires, it refreshes once and retries.
 *  - Every failure becomes an ApiError with a message that can be shown to people.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

// Long enough for a slow AI answer (the API gives up on Gemini after 45 seconds) to arrive instead of showing a server error.
const TIMEOUT_MS = 180_000;
const UPLOAD_TIMEOUT_MS = 120_000;
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

function messageFrom(body: unknown, status: number): string {
  const m = (body as { message?: unknown })?.message;
  if (Array.isArray(m)) return m.map((x) => humanise(String(x))).join('. ');
  if (typeof m === 'string' && m) return humanise(m);
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Something went wrong. Please try again.';
}

/** Turns validation messages such as "progressAfter must not be greater than 100" into plain text. */
function humanise(s: string) {
  return s.replace(/^([a-z]+)([A-Z])/, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`).replace(/^\w/, (c) => c.toUpperCase());
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; timeoutMs?: number; noRefresh?: boolean } = {},
): Promise<T> {
  const { json, timeoutMs, noRefresh, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? (body instanceof FormData ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS));

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...rest, headers, body, credentials: 'same-origin', signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') throw new ApiError('The server took too long to respond. Please try again.', 0);
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0);
  }
  clearTimeout(timer);

  if (res.status === 401 && !noRefresh && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...init, noRefresh: true });
  }
  if (res.status === 204) return undefined as T;

  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (!res.ok) {
    throw new ApiError(messageFrom(data, res.status), res.status, (data as { requestId?: string })?.requestId);
  }
  return unwrap<T>(data);
}

interface Envelope {
  success: true;
  message: string;
  data: unknown;
  meta: { total: number; page: number; pageSize: number; totalPages: number } | null;
}

/**
 * The API wraps every success as { success, message, data, meta }.
 * Pages receive `data` directly; a paginated list comes back as { items, total, page, pageSize, totalPages }.
 */
function unwrap<T>(body: unknown): T {
  const e = body as Envelope | null;
  if (!e || typeof e !== 'object' || e.success !== true || !('data' in e)) return body as T;
  if (e.meta && Array.isArray(e.data)) return { items: e.data, ...e.meta } as T;
  return e.data as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const patch = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json: json ?? {} });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', body: form });
