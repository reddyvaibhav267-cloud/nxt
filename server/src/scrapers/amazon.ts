/**
 * Amazon Best Sellers / New Releases scraper.
 *
 * These category pages are server-rendered, so fetch + Cheerio is enough —
 * no headless browser. (Movers & Shakers is client-rendered and excluded.)
 * Amazon bot-detects aggressively: realistic headers, an `i18n-prefs=USD`
 * cookie for stable pricing, low volume and tolerant parsing matter more
 * than the selectors. Any CAPTCHA/challenge page surfaces as an error so we
 * degrade to fallback data.
 */
import * as cheerio from 'cheerio';
import { getText, HttpError } from '../lib/http.js';
import { AMAZON_CATEGORIES } from '../config.js';
import type { Product } from '../types.js';

const MARKETPLACE = 'https://www.amazon.com';

export interface AmazonItem {
  id: string;
  title: string;
  url: string | null;
  imageUrl: string | null;
  rank: number;
  rankDelta: number | null;
  priceUsd: number | null;
  category: string;
  categoryId: string;
}

/**
 * Reconstruct a USD price.
 *
 * Amazon's `.a-offscreen` text sometimes drops the decimal separator
 * ("$2492" for $24.92), so prefer the structured parts —
 * `.a-price-whole` + `.a-price-fraction` — when present.
 */
function parsePriceFromCard(scope: {
  find: (sel: string) => { first: () => { text: () => string } };
}): number | null {
  const whole = scope.find('.a-price-whole').first().text().replace(/[^\d]/g, '');
  const fraction = scope
    .find('.a-price-fraction')
    .first()
    .text()
    .replace(/\D/g, '')
    .padEnd(2, '0')
    .slice(0, 2);

  if (whole) {
    const n = Number(`${whole}.${fraction || '00'}`);
    if (Number.isFinite(n) && n > 0) return Number(n.toFixed(2));
  }

  const offscreen = scope.find('.a-price .a-offscreen').first().text();
  return parsePrice(offscreen);
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/\s/g, '');
  const usd = cleaned.match(/\$([\d,]+(?:\.\d{2})?)/);
  if (usd) {
    let raw = usd[1].replace(/,/g, '');
    // No decimal separator at all → the value is almost certainly cents-less
    // concatenated parts (e.g. "2492" for 24.92). Treat 4-digit no-dot as dollars.cents.
    if (!raw.includes('.') && raw.length === 4) raw = `${raw.slice(0, -2)}.${raw.slice(-2)}`;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
  }
  const generic = cleaned.match(/([\d,]+(?:\.\d{2})?)/);
  if (!generic) return null;
  const n = Number(generic[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
}

function isChallenge(html: string): boolean {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes('captcha') ||
    head.includes('/errors/validatecaptcha') ||
    head.includes('api-services-support@amazon') ||
    head.includes('automated access') ||
    head.includes('enter the characters you see below')
  );
}

const REQUEST_HEADERS = {
  Referer: 'https://www.amazon.com/',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  // Force USD pricing regardless of egress geo-IP.
  Cookie: 'i18n-prefs=USD; lc-main=en_US',
};

export async function scrapeAmazonCategory(cat: {
  id: string;
  name: string;
  path: string;
}): Promise<AmazonItem[]> {
  const url = `${MARKETPLACE}${cat.path}`;
  const html = await getText(url, {
    retries: 3,
    timeoutMs: 20_000,
    headers: REQUEST_HEADERS,
  });

  if (isChallenge(html)) {
    throw new HttpError('Amazon served a CAPTCHA/challenge page', 403, url);
  }

  const $ = cheerio.load(html);
  const items: AmazonItem[] = [];

  const cards = $('.zg-grid-general-faceout');
  if (cards.length === 0) {
    throw new Error(`Amazon: no product cards parsed from ${cat.id} (layout change?)`);
  }

  cards.each((i, el) => {
    const node = $(el);
    const inner = node.find('.p13n-sc-uncoverable-faceout').first();
    const scope = inner.length ? inner : node;

    const img = scope.find('img.p13n-product-image, img').first();
    const title =
      scope
        .find('._cDEzb_p13n-sc-css-line-clamp-3_g3dy1, ._cDEzb_p13n-sc-css-line-clamp-2_2q2cc')
        .first()
        .text()
        .trim() ||
      (img.attr('alt')?.trim() ?? '') ||
      '';
    if (!title || title.length < 4) return;

    // ASIN is the inner faceout's id, otherwise recovered from the /dp/ link.
    const href =
      scope.find('a[href*="/dp/"]').first().attr('href') ??
      node.find('a[href*="/dp/"]').first().attr('href') ??
      '';
    const asin = scope.attr('id') ?? href.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ?? `row-${i}`;

    const rankBadge = node.find('.zg-bdg-text, .zg-badge-text').first().text().trim();
    const rank = Number(rankBadge.replace(/\D/g, '')) || i + 1;

    // Best Sellers show a rank-change badge like "+1,204" or "No change".
    const meta = node.find('._cDEzb_zg-grid-rank-metadata_33jPv, .a-color-success').text();
    let rankDelta: number | null = null;
    const deltaMatch = meta.match(/([+-])\s?([\d,]+)/);
    if (deltaMatch) {
      const n = Number(deltaMatch[2].replace(/,/g, ''));
      rankDelta = deltaMatch[1] === '-' ? -n : n;
    }

    const priceUsd = parsePriceFromCard(scope);

    const rawSrc = img.attr('src') ?? img.attr('data-src') ?? null;
    const imageUrl = rawSrc ? rawSrc.replace(/\._[^.]*_\.jpg$/, '.jpg') : null;

    const link = href
      ? href.startsWith('http')
        ? href.split('/ref=')[0]
        : `${MARKETPLACE}${href.split('/ref=')[0]}`
      : null;

    items.push({
      id: asin,
      title: title.replace(/\s+/g, ' ').slice(0, 160),
      url: link,
      imageUrl,
      rank,
      rankDelta,
      priceUsd,
      category: cat.name,
      categoryId: cat.id,
    });
  });

  return items;
}

export async function scrapeAmazonAll(): Promise<AmazonItem[]> {
  const out: AmazonItem[] = [];
  const errors: string[] = [];

  for (const cat of AMAZON_CATEGORIES) {
    try {
      const items = await scrapeAmazonCategory(cat);
      out.push(...items);
      // Amazon is strict — pause between category hits.
      await new Promise((r) => setTimeout(r, 1800 + Math.random() * 2200));
    } catch (e) {
      errors.push(`${cat.id}: ${(e as Error).message}`);
      // Back off harder after a failure.
      await new Promise((r) => setTimeout(r, 4000 + Math.random() * 3000));
    }
  }

  // Dedupe by ASIN — a product can appear in Best Sellers and New Releases.
  const seen = new Set<string>();
  const deduped = out.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  if (deduped.length === 0 && errors.length > 0) {
    throw new Error(`Amazon scrape failed for all categories — ${errors[0]}`);
  }
  return deduped;
}

/** Map raw Amazon rows onto our Product shape (niche assignment happens upstream). */
export function toProductShape(
  item: AmazonItem,
  nicheSlug: string,
  observedAt: string,
): Product {
  const velocity = Math.min(
    99,
    Math.max(
      10,
      45 + (item.rankDelta ? Math.log10(Math.abs(item.rankDelta) + 1) * 18 : 0) - item.rank * 0.4,
    ),
  );
  const score = Math.round(
    Math.min(99, Math.max(30, 50 + velocity * 0.4 + Math.max(0, item.rankDelta ?? 0) * 0.02)),
  );

  return {
    id: `amz-${item.id}`,
    nicheSlug,
    title: item.title,
    source: 'amazon',
    priceUsd: item.priceUsd,
    rank: item.rank,
    rankDelta: item.rankDelta,
    velocity: Number(velocity.toFixed(1)),
    score,
    imageUrl: item.imageUrl,
    url: item.url,
    metricLabel: 'rank Δ',
    metricValue: item.rankDelta ?? 0,
    observedAt,
  };
}
