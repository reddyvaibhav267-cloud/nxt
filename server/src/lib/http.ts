/** Shared HTTP layer: browser-like headers, cookie jar, retries with jittered backoff. */

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
];

let uaCursor = 0;
export function nextUserAgent(): string {
  uaCursor = (uaCursor + 1) % USER_AGENTS.length;
  return USER_AGENTS[uaCursor];
}

/** Very small per-host cookie jar (enough for Google's NID warm-up). */
const cookieJars = new Map<string, Map<string, string>>();

function storeCookies(host: string, setCookie: string[]): void {
  let jar = cookieJars.get(host);
  if (!jar) {
    jar = new Map();
    cookieJars.set(host, jar);
  }
  for (const raw of setCookie) {
    const first = raw.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
}

function cookieHeader(host: string): string | undefined {
  const jar = cookieJars.get(host);
  if (!jar || jar.size === 0) return undefined;
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

export interface FetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Max attempts including the first (default 3). */
  retries?: number;
  timeoutMs?: number;
  /** Extra delay before the first attempt (default: random 400-1200ms). */
  startDelayMs?: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function request(url: string, opts: FetchOptions = {}): Promise<Response> {
  const {
    retries = 3,
    timeoutMs = 15_000,
    startDelayMs,
    headers = {},
    ...rest
  } = opts;

  const host = new URL(url).host;
  let lastErr: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt === 0) {
      await sleep(startDelayMs ?? 400 + Math.random() * 800);
    } else {
      // Exponential backoff with jitter, capped at 30s.
      const base = Math.min(30_000, 750 * 2 ** (attempt - 1));
      await sleep(base * (0.75 + Math.random() * 0.5));
    }

    const jar = cookieHeader(host);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...rest,
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': nextUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          ...(jar ? { Cookie: jar } : {}),
          ...headers,
        },
      });

      const setCookie = res.headers.getSetCookie?.() ?? [];
      if (setCookie.length) storeCookies(host, setCookie);

      // Retry on rate limits and transient server errors only.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(`HTTP ${res.status}`, res.status, url);
        const retryAfter = Number(res.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await sleep(Math.min(retryAfter * 1000, 60_000));
        }
        continue;
      }

      return res;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Request failed after ${retries} attempts: ${url}`);
}

export async function getText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await request(url, { ...opts, headers: { Accept: 'text/html,*/*', ...opts.headers } });
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status, url);
  return res.text();
}

export async function getJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await request(url, {
    ...opts,
    headers: { Accept: 'application/json,text/plain,*/*', ...opts.headers },
  });
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status, url);
  return (await res.json()) as T;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: FetchOptions = {},
): Promise<T> {
  const res = await request(url, {
    ...opts,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json,text/plain,*/*',
      ...opts.headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status, url);
  return (await res.json()) as T;
}

/** Simple per-source daily request counter for politeness caps. */
const dailyHits = new Map<string, { day: string; count: number }>();

export function hitBudget(source: string, cap: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const cur = dailyHits.get(source);
  if (!cur || cur.day !== day) {
    dailyHits.set(source, { day, count: 1 });
    return true;
  }
  if (cur.count >= cap) return false;
  cur.count++;
  return true;
}
