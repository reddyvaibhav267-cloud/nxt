/**
 * Refresh orchestrator.
 *
 * Runs each source on its own cron cadence, records health, persists results
 * and broadcasts an SSE event. Failures never throw out of the scheduler —
 * the affected source simply serves fallback data and reports DEGRADED.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import type { Product, RefreshEvent, SourceId, SourceStatus } from '../types.js';
import {
  bumpRefreshCounter,
  ensureSeedSeries,
  listNiches,
  logRefresh,
  recordHealth,
  replaceProductsForSource,
  replaceSeries,
  upsertNiche,
} from '../db/repo.js';
import { NICHE_SEEDS, nichesFromSeed, productsFromSeed, seriesFromSeed } from '../db/seed-data.js';
import { fetchTrackedKeywords } from '../scrapers/googleTrends.js';
import { scrapeAmazonAll, toProductShape } from '../scrapers/amazon.js';
import { scrapeTikTokTrends, rowsToProducts } from '../scrapers/tiktok.js';
import { nicheForKeyword, nicheSlugForCategory, opportunityScore, productScore } from '../scoring/opportunity.js';
import { hitBudget } from '../lib/http.js';

type Listener = (ev: RefreshEvent) => void;
const listeners = new Set<Listener>();

export function onRefresh(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(ev: RefreshEvent): void {
  logRefresh(ev);
  bumpRefreshCounter();
  for (const fn of listeners) {
    try {
      fn(ev);
    } catch {
      /* listener errors must not break the refresh loop */
    }
  }
}

/** Merge the static niche catalogue into the DB on every boot. */
export function bootstrapNiches(): void {
  // Upsert the full catalogue so newly added seeds appear in existing DBs
  // without wiping live rows. The first refresh re-scores from live data.
  for (const n of nichesFromSeed()) upsertNiche(n);
}

/* ----------------------------------------------------------- google trends */

async function refreshGoogleTrends(): Promise<void> {
  const source: SourceId = 'google_trends';
  const startedAt = new Date().toISOString();

  if (!config.scrapingEnabled) {
    ensureSeedSeries();
    recordHealth(source, { status: 'fallback', ok: false, error: 'SCRAPING_ENABLED=false' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'scraping disabled' });
    return;
  }

  if (!hitBudget(source, config.dailyCaps.google_trends)) {
    recordHealth(source, { status: 'stale', ok: false, error: 'daily request cap reached' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'daily cap' });
    return;
  }

  try {
    const series = await fetchTrackedKeywords();
    let count = 0;
    for (const [keyword, points] of series) {
      const slug = nicheForKeyword(keyword);
      replaceSeries(keyword, slug, points);
      count++;
    }

    // Growth from the newest two points nudges niche scores.
    const niches = listNiches();
    for (const n of niches) {
      const kw = n.keywords[0];
      const pts = series.get(kw);
      if (!pts || pts.length < 2) continue;
      const last = pts[pts.length - 1].v;
      const prev = pts[pts.length - 2].v;
      const delta = prev === 0 ? 0 : ((last - prev) / prev) * 100;
      upsertNiche({
        ...n,
        wowGrowth: Number((n.wowGrowth * 0.7 + delta * 0.3).toFixed(1)),
        score: opportunityScore({
          demandIndex: n.demandIndex,
          wowGrowth: n.wowGrowth * 0.7 + delta * 0.3,
          saturation: n.saturation,
          marginBand: n.marginBand,
        }),
      });
    }

    recordHealth(source, { status: 'live', ok: true, itemCount: count });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count });
  } catch (e) {
    const msg = (e as Error).message;
    ensureSeedSeries();
    const status: SourceStatus = 'degraded';
    recordHealth(source, { status, ok: false, error: msg });
    emit({ type: 'refresh', source, status: 'error', at: startedAt, count: 0, message: msg });
  }
}

/* ------------------------------------------------------------------ amazon */

async function refreshAmazon(): Promise<void> {
  const source: SourceId = 'amazon';
  const startedAt = new Date().toISOString();

  if (!config.scrapingEnabled) {
    seedAmazonProducts();
    recordHealth(source, { status: 'fallback', ok: false, error: 'SCRAPING_ENABLED=false' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'scraping disabled' });
    return;
  }

  if (!hitBudget(source, config.dailyCaps.amazon)) {
    recordHealth(source, { status: 'stale', ok: false, error: 'daily request cap reached' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'daily cap' });
    return;
  }

  try {
    const items = await scrapeAmazonAll();
    const observedAt = new Date().toISOString();
    const niches = listNiches();
    const demandBySlug = new Map(niches.map((n) => [n.slug, n.demandIndex]));

    const products: Product[] = items.map((item) => {
      const slug = nicheSlugForCategory(item.category);
      const shaped = toProductShape(item, slug, observedAt);
      return {
        ...shaped,
        score: productScore({
          ...shaped,
          metricValue: shaped.metricValue,
          demandIndex: demandBySlug.get(slug),
        }),
      };
    });

    // Keep only the strongest rows so the grid stays readable.
    products.sort((a, b) => b.score - a.score);
    replaceProductsForSource('amazon', products.slice(0, 80));

    recordHealth(source, { status: 'live', ok: true, itemCount: products.length });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: products.length });
  } catch (e) {
    const msg = (e as Error).message;
    // Degrade to whatever we have; if nothing, seed.
    seedAmazonProducts(true);
    recordHealth(source, { status: 'degraded', ok: false, error: msg });
    emit({ type: 'refresh', source, status: 'error', at: startedAt, count: 0, message: msg });
  }
}

/** Write seed Amazon rows (used on boot failure or disabled scraping). */
function seedAmazonProducts(preserveIfPresent = false): void {
  const existing = listNiches();
  if (preserveIfPresent && existing.length > 0) {
    // Only fill if the source has no rows at all.
    const seeded = productsFromSeed().filter((p) => p.source === 'amazon');
    if (seeded.length === 0) return;
  }
  const rows = productsFromSeed()
    .filter((p) => p.source === 'amazon')
    .map((p) => ({ ...p, score: productScore({ ...p, metricValue: p.metricValue }) }));
  replaceProductsForSource('amazon', rows);
}

/* ------------------------------------------------------------------ tiktok */

async function refreshTikTok(): Promise<void> {
  const source: SourceId = 'tiktok';
  const startedAt = new Date().toISOString();

  if (!config.scrapingEnabled) {
    seedTikTokProducts();
    recordHealth(source, { status: 'fallback', ok: false, error: 'SCRAPING_ENABLED=false' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'scraping disabled' });
    return;
  }

  if (!hitBudget(source, config.dailyCaps.tiktok)) {
    recordHealth(source, { status: 'stale', ok: false, error: 'daily request cap reached' });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: 0, message: 'daily cap' });
    return;
  }

  try {
    const { rowsByCategory } = await scrapeTikTokTrends();
    const observedAt = new Date().toISOString();
    const products = rowsToProducts(
      rowsByCategory,
      NICHE_SEEDS.map((n) => ({ slug: n.slug, keywords: n.keywords, fallbackSlug: n.slug })),
      observedAt,
    ).map((p) => ({ ...p, score: productScore({ ...p, metricValue: p.metricValue }) }));

    products.sort((a, b) => b.score - a.score);
    replaceProductsForSource('tiktok', products.slice(0, 80));

    recordHealth(source, { status: 'live', ok: true, itemCount: products.length });
    emit({ type: 'refresh', source, status: 'ok', at: startedAt, count: products.length });
  } catch (e) {
    const msg = (e as Error).message;
    seedTikTokProducts(true);
    recordHealth(source, { status: 'degraded', ok: false, error: msg });
    emit({ type: 'refresh', source, status: 'error', at: startedAt, count: 0, message: msg });
  }
}

function seedTikTokProducts(preserveIfPresent = false): void {
  void preserveIfPresent;
  const rows = productsFromSeed()
    .filter((p) => p.source === 'tiktok')
    .map((p) => ({ ...p, score: productScore({ ...p, metricValue: p.metricValue }) }));
  replaceProductsForSource('tiktok', rows);
}

/** Seed the google_trends keyword rows (search-interest stand-ins for products). */
function seedGoogleProducts(): void {
  const rows = productsFromSeed()
    .filter((p) => p.source === 'google_trends')
    .map((p) => ({ ...p, score: productScore({ ...p, metricValue: p.metricValue }) }));
  replaceProductsForSource('google_trends', rows);
}

/* --------------------------------------------------------------- lifecycle */

const tasks: ScheduledTask[] = [];

export async function runAllNow(): Promise<void> {
  await Promise.allSettled([refreshGoogleTrends(), refreshAmazon(), refreshTikTok()]);
}

export function startScheduler(): void {
  bootstrapNiches();
  ensureSeedSeries();

  // Always have data in the DB before the first cron tick.
  seedAmazonProducts();
  seedTikTokProducts();
  seedGoogleProducts();

  const register = (pattern: string, fn: () => Promise<void>) => {
    if (!cron.validate(pattern)) return;
    const task = cron.schedule(pattern, () => void fn(), { scheduled: true, timezone: 'UTC' });
    tasks.push(task);
  };

  register(config.schedule.google_trends, refreshGoogleTrends);
  register(config.schedule.amazon, refreshAmazon);
  register(config.schedule.tiktok, refreshTikTok);

  // Kick off the first live refresh immediately so fresh data lands in the DB
  // right after boot; the hourly crontabs take over from there.
  void runAllNow();
}

export function stopScheduler(): void {
  for (const t of tasks) t.stop();
  tasks.length = 0;
}

export const refreshers = { refreshGoogleTrends, refreshAmazon, refreshTikTok };
export { seriesFromSeed };
