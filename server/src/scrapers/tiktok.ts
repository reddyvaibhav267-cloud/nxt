/**
 * TikTok Creative Center scraper.
 *
 * The old signed `creative_radar_api/v1/popular_trend/*` endpoints were
 * deprecated in Oct 2026. The replacement Video tab endpoint is unsigned:
 *   POST ads.us.tiktok.com/CreativeOne/Report/CreativeCenterGetTopContentsList
 * It only needs browser-like headers. Logged-out it returns ~4 records per call,
 * so volume comes from multiplying across sort orders × content categories.
 *
 * TRAP: TikTok answers `{ code: 0, data: null, msg: "deprecated" }` on dead
 * endpoints with HTTP 200 — always treat code 0 + empty data as an error.
 */
import { postJson, HttpError } from '../lib/http.js';
import type { Product } from '../types.js';

const ENDPOINT = 'https://ads.us.tiktok.com/CreativeOne/Report/CreativeCenterGetTopContentsList';

type SortKey = 0 | 1 | 2;
type CategoryKey = 0 | 1 | 2 | 3;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 0, label: 'views' },
  { key: 2, label: 'recent' },
];

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 0, label: 'All' },
  { key: 2, label: 'Beauty' },
];

/**
 * Network-level failures (DNS block, connection refused, TLS) mean the whole
 * host is unreachable — retrying every sort/category combination would just
 * burn minutes before failing anyway. Abort the source immediately.
 */
function isUnreachable(e: unknown): boolean {
  const err = e as { cause?: { code?: string }; message?: string; name?: string };
  const code = err?.cause?.code ?? '';
  const msg = String(err?.message ?? '');
  return (
    err?.name === 'AbortError' ||
    ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT', 'ERR_SOCKET_CONNECTION_TIMEOUT'].includes(
      code,
    ) ||
    msg.includes('fetch failed') ||
    msg.includes('aborted')
  );
}

interface TikTokRow {
  contentId?: string | number;
  title?: string;
  desc?: string;
  coverUrl?: string;
  videoUrl?: string;
  views?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  authorUsername?: string;
  authorNickname?: string;
  [k: string]: unknown;
}

interface TikTokResponse {
  code?: number;
  msg?: string;
  data?: {
    list?: TikTokRow[];
    contents?: TikTokRow[];
    rows?: TikTokRow[];
    [k: string]: unknown;
  } | null;
}

function pickList(res: TikTokResponse): TikTokRow[] {
  const d = res.data;
  if (!d) return [];
  if (Array.isArray(d.list)) return d.list;
  if (Array.isArray(d.contents)) return d.contents;
  if (Array.isArray(d.rows)) return d.rows;
  // Some shapes nest under a sub-object.
  for (const v of Object.values(d)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v as TikTokRow[];
  }
  return [];
}

function rowToProduct(
  row: TikTokRow,
  idx: number,
  nicheSlug: string,
  sortLabel: string,
  category: string,
  observedAt: string,
): Product {
  const title =
    (typeof row.title === 'string' && row.title) ||
    (typeof row.desc === 'string' && row.desc) ||
    `TikTok trend ${idx + 1}`;

  const views = Number(row.views ?? row.viewCount ?? 0) || 0;
  const likes = Number(row.likeCount ?? row.likes ?? 0) || 0;
  const comments = Number(row.commentCount ?? 0) || 0;
  const shares = Number(row.shareCount ?? 0) || 0;
  const engagement = likes + comments * 2 + shares * 3;

  // Views dominate; engagement acts as a quality multiplier.
  const velocity = Math.min(
    99,
    Math.max(8, Math.log10(views + 1) * 11 + Math.log10(engagement + 1) * 4),
  );
  const score = Math.round(Math.min(99, Math.max(30, velocity * 0.95 + (idx === 0 ? 8 : 0))));

  const id = String(row.contentId ?? row.videoUrl ?? `${category}-${sortLabel}-${idx}`);

  return {
    id: `tt-${id}`,
    nicheSlug,
    title: String(title).replace(/\s+/g, ' ').slice(0, 160),
    source: 'tiktok',
    priceUsd: null,
    rank: idx + 1,
    rankDelta: null,
    velocity: Number(velocity.toFixed(1)),
    score,
    imageUrl: typeof row.coverUrl === 'string' ? row.coverUrl : null,
    url:
      typeof row.videoUrl === 'string'
        ? row.videoUrl
        : row.authorUsername
          ? `https://www.tiktok.com/@${row.authorUsername}`
          : null,
    metricLabel: 'views',
    metricValue: views,
    observedAt,
  };
}

export interface TikTokFetchResult {
  products: Product[];
  /** Raw rows keyed by category for niche-assignment heuristics. */
  rowsByCategory: Map<string, TikTokRow[]>;
}

/**
 * Pull trending content across sort × category combinations.
 * nicheSlug is assigned by the caller via `assignNiche` heuristics; here we
 * return rows grouped so the scheduler can map them onto niches.
 */
export async function scrapeTikTokTrends(): Promise<TikTokFetchResult> {
  const rowsByCategory = new Map<string, TikTokRow[]>();
  const errors: string[] = [];

  for (const cat of CATEGORIES) {
    for (const sort of SORTS) {
      try {
        const res = await postJson<TikTokResponse>(
          ENDPOINT,
          {
            page: 1,
            limit: 20,
            sortType: sort.key,
            contentType: cat.key,
            countryCode: 'US',
            period: 7,
          },
          {
            retries: 1,
            timeoutMs: 8_000,
            startDelayMs: 200,
            headers: {
              Origin: 'https://ads.tiktok.com',
              Referer: 'https://ads.tiktok.com/creative/creativeCenter/trends',
              'agw-js-conv': '1',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'same-site',
            },
          },
        );

        // Silent-deprecation guard: HTTP 200 + code 0 + no data = dead endpoint.
        const list = pickList(res);
        if (list.length === 0) {
          const msg = typeof res.msg === 'string' ? res.msg : 'empty data';
          if (res.code === 0 && (msg === 'deprecated' || !res.data)) {
            throw new Error(`TikTok endpoint deprecated (${msg})`);
          }
          errors.push(`${cat.label}/${sort.label}: ${msg}`);
        } else {
          const key = `${cat.label}::${sort.label}`;
          rowsByCategory.set(key, [...(rowsByCategory.get(key) ?? []), ...list]);
        }

        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      } catch (e) {
        // Host unreachable (blocked network / DNS) — stop trying other combos.
        if (isUnreachable(e)) {
          throw new Error(
            `TikTok unreachable (${(e as Error).message}) — host blocked from this network`,
          );
        }
        errors.push(`${cat.label}/${sort.label}: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
      }
    }
  }

  if (rowsByCategory.size === 0) {
    throw new Error(
      `TikTok scrape produced no data — ${errors[0] ?? 'unknown failure'}`,
    );
  }

  return { products: [], rowsByCategory };
}

/** Keyword → niche mapping used to file TikTok rows under a niche. */
export function assignNiche(
  text: string,
  nicheKeywords: { slug: string; keywords: string[] }[],
): string | null {
  const hay = text.toLowerCase();
  for (const n of nicheKeywords) {
    if (n.keywords.some((k) => hay.includes(k.toLowerCase()))) return n.slug;
  }
  return null;
}

export function rowsToProducts(
  rowsByCategory: Map<string, TikTokRow[]>,
  nicheKeywords: { slug: string; keywords: string[]; fallbackSlug: string }[],
  observedAt: string,
): Product[] {
  const out: Product[] = [];
  const seen = new Set<string>();

  for (const [key, rows] of rowsByCategory) {
    const [, sortLabel] = key.split('::');
    const category = key.split('::')[0];
    rows.slice(0, 12).forEach((row, idx) => {
      const text = `${row.title ?? ''} ${row.desc ?? ''}`;
      const slug =
        assignNiche(text, nicheKeywords) ??
        nicheKeywords[idx % nicheKeywords.length]?.slug ??
        'mobile-workstation';

      const product = rowToProduct(row, idx, slug, sortLabel, category, observedAt);
      if (seen.has(product.id)) return;
      seen.add(product.id);
      out.push(product);
    });
  }
  return out;
}

export { HttpError };
