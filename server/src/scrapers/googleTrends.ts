/**
 * Google Trends scraper (unofficial).
 *
 * Flow mirrors pytrends:
 *   1. GET /trends/api/explore   -> widget tokens (needs NID cookie from a warm-up hit)
 *   2. GET /trends/api/widgetdata/multiline -> interest-over-time series
 * Responses are XSSI-prefixed with `)]}'` and must be stripped before JSON.parse.
 *
 * Google rate-limits per IP/session (HTTP 429) and can change endpoints without
 * notice — every failure is surfaced as an error so the caller can fall back.
 */
import { request, HttpError } from '../lib/http.js';
import type { SeriesPoint } from '../types.js';
import { GOOGLE_TRENDS_KEYWORDS } from '../config.js';

const BASE = 'https://trends.google.com';
const HL = 'en-US';
const TZ = '0';

interface ExploreResponse {
  widgets?: Array<{
    id: string;
    request: Record<string, unknown>;
    token: string;
  }>;
}

interface MultilineResponse {
  default?: {
    timelineData?: Array<{
      time: string;
      formattedTime?: string;
      value: number[];
    }>;
  };
}

function stripXssi(text: string): string {
  const idx = text.indexOf('\n');
  return idx >= 0 ? text.slice(idx + 1) : text.replace(/^\)\]\}',?\s*/, '');
}

async function warmUp(): Promise<void> {
  await request(`${BASE}/trends/`, { retries: 2, timeoutMs: 12_000 });
}

export async function fetchInterestSeries(
  keywords: string[],
  opts: { geo?: string; timeframe?: string } = {},
): Promise<Map<string, SeriesPoint[]>> {
  const geo = opts.geo ?? '';
  const timeframe = opts.timeframe ?? 'today 3-m';

  await warmUp();

  const exploreReq = {
    comparisonItem: keywords.map((keyword) => ({ keyword, geo, time: timeframe })),
    category: 0,
    property: '',
  };

  const exploreUrl =
    `${BASE}/trends/api/explore?hl=${HL}&tz=${TZ}&req=` +
    encodeURIComponent(JSON.stringify(exploreReq));

  const exploreText = await getTextWithRetry(exploreUrl);
  const explore = JSON.parse(stripXssi(exploreText)) as ExploreResponse;

  const timeline = explore.widgets?.find((w) => w.id === 'TIMESERIES');
  if (!timeline) throw new Error('Google Trends: TIMESERIES widget missing from explore response');

  const multilineUrl =
    `${BASE}/trends/api/widgetdata/multiline?hl=${HL}&tz=${TZ}` +
    `&req=${encodeURIComponent(JSON.stringify(timeline.request))}` +
    `&token=${encodeURIComponent(timeline.token)}`;

  const multilineText = await getTextWithRetry(multilineUrl);
  const data = JSON.parse(stripXssi(multilineText)) as MultilineResponse;

  const rows = data.default?.timelineData;
  if (!rows || rows.length === 0) {
    throw new Error('Google Trends: empty timelineData');
  }

  const out = new Map<string, SeriesPoint[]>();
  keywords.forEach((kw, i) => {
    const points: SeriesPoint[] = rows.map((r) => ({
      t: new Date(Number(r.time) * 1000).toISOString(),
      v: Number(r.value?.[i] ?? 0),
    }));
    out.set(kw, points);
  });

  return out;
}

async function getTextWithRetry(url: string): Promise<string> {
  const res = await request(url, {
    retries: 3,
    timeoutMs: 15_000,
    headers: { Referer: `${BASE}/trends/` },
  });

  if (res.status === 429) {
    throw new HttpError('Google Trends rate limited (429)', 429, url);
  }
  if (!res.ok) {
    throw new HttpError(`Google Trends HTTP ${res.status}`, res.status, url);
  }

  const text = await res.text();
  // A 200 that returns HTML means the endpoint moved or we were served a block page.
  const head = text.trimStart().slice(0, 15);
  if (head.startsWith('<!doctype') || head.startsWith('<html')) {
    throw new Error('Google Trends returned HTML instead of JSON (endpoint drift or block page)');
  }
  return text;
}

/**
 * Fetch the tracked keyword set.
 * Google's explore endpoint accepts at most 5 comparisonItem entries per
 * request, so the keyword list is chunked into batches of 5 with a pause
 * between each to stay under the per-session rate limit.
 */
export async function fetchTrackedKeywords(): Promise<Map<string, SeriesPoint[]>> {
  const out = new Map<string, SeriesPoint[]>();
  const MAX_PER_REQUEST = 5;
  const batches: string[][] = [];
  for (let i = 0; i < GOOGLE_TRENDS_KEYWORDS.length; i += MAX_PER_REQUEST) {
    batches.push(GOOGLE_TRENDS_KEYWORDS.slice(i, i + MAX_PER_REQUEST));
  }

  for (const batch of batches) {
    const result = await fetchInterestSeries(batch);
    for (const [k, v] of result) out.set(k, v);
    // Gentle pause between batches.
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  }
  return out;
}
