import { getDb, plain, setMeta, getMeta } from './index.js';
import type {
  Niche,
  Product,
  RefreshEvent,
  SeriesPoint,
  SourceHealth,
  SourceId,
  SourceStatus,
  Stats,
  TrendSeries,
} from '../types.js';
import { NICHE_SEEDS, seriesFromSeed } from './seed-data.js';

/* ------------------------------------------------------------------ niches */

export function upsertNiche(n: Niche): void {
  getDb()
    .prepare(
      `INSERT INTO niches (slug,name,code,category,description,keywords,margin_band,avg_price_usd,
         saturation,score,wow_growth,mom_growth,demand_index,product_count,emoji,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET
         name=excluded.name, code=excluded.code, category=excluded.category,
         description=excluded.description, keywords=excluded.keywords,
         margin_band=excluded.margin_band, avg_price_usd=excluded.avg_price_usd,
         saturation=excluded.saturation, score=excluded.score,
         wow_growth=excluded.wow_growth, mom_growth=excluded.mom_growth,
         demand_index=excluded.demand_index, product_count=excluded.product_count,
         emoji=excluded.emoji, updated_at=datetime('now')`,
    )
    .run(
      n.slug,
      n.name,
      n.code,
      n.category,
      n.description,
      JSON.stringify(n.keywords),
      n.marginBand,
      n.avgPriceUsd,
      n.saturation,
      n.score,
      n.wowGrowth,
      n.momGrowth,
      n.demandIndex,
      n.productCount,
      n.emoji ?? null,
    );
}

interface NicheRow {
  slug: string;
  name: string;
  code: string;
  category: string;
  description: string;
  keywords: string;
  margin_band: string;
  avg_price_usd: number;
  saturation: number;
  score: number;
  wow_growth: number;
  mom_growth: number;
  demand_index: number;
  product_count: number;
  emoji: string | null;
}

function rowToNiche(r: NicheRow): Niche {
  return {
    slug: r.slug,
    name: r.name,
    code: r.code,
    category: r.category,
    description: r.description,
    keywords: JSON.parse(r.keywords || '[]'),
    marginBand: r.margin_band as Niche['marginBand'],
    avgPriceUsd: r.avg_price_usd,
    saturation: r.saturation,
    score: r.score,
    wowGrowth: r.wow_growth,
    momGrowth: r.mom_growth,
    demandIndex: r.demand_index,
    productCount: r.product_count,
    emoji: r.emoji ?? undefined,
  };
}

export function listNiches(): Niche[] {
  const rows = getDb()
    .prepare('SELECT * FROM niches ORDER BY score DESC')
    .all() as unknown[];
  return rows.map((r) => rowToNiche(plain<NicheRow>(r)));
}

export function getNiche(slug: string): Niche | null {
  const row = getDb().prepare('SELECT * FROM niches WHERE slug = ?').get(slug);
  return row ? rowToNiche(plain<NicheRow>(row)) : null;
}

export function nicheCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM niches').get() as { c: number };
  return Number(row.c);
}

/* ---------------------------------------------------------------- products */

export function replaceProductsForSource(source: SourceId, items: Product[]): void {
  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM products WHERE source = ?').run(source);
    const stmt = db.prepare(
      `INSERT INTO products (id,niche_slug,title,source,price_usd,rank,rank_delta,velocity,score,
         image_url,url,metric_label,metric_value,observed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    for (const p of items) {
      stmt.run(
        p.id,
        p.nicheSlug,
        p.title,
        p.source,
        p.priceUsd,
        p.rank,
        p.rankDelta,
        p.velocity,
        p.score,
        p.imageUrl,
        p.url,
        p.metricLabel,
        p.metricValue,
        p.observedAt,
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

interface ProductRow {
  id: string;
  niche_slug: string;
  title: string;
  source: string;
  price_usd: number | null;
  rank: number | null;
  rank_delta: number | null;
  velocity: number;
  score: number;
  image_url: string | null;
  url: string | null;
  metric_label: string;
  metric_value: number;
  observed_at: string;
}

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    nicheSlug: r.niche_slug,
    title: r.title,
    source: r.source as SourceId,
    priceUsd: r.price_usd,
    rank: r.rank,
    rankDelta: r.rank_delta,
    velocity: r.velocity,
    score: r.score,
    imageUrl: r.image_url,
    url: r.url,
    metricLabel: r.metric_label,
    metricValue: r.metric_value,
    observedAt: r.observed_at,
  };
}

export function listProducts(opts: {
  niche?: string;
  source?: string;
  sort?: 'score' | 'velocity' | 'rank';
  limit?: number;
} = {}): Product[] {
  const limit = Math.min(opts.limit ?? 60, 500);
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.niche) {
    where.push('niche_slug = ?');
    params.push(opts.niche);
  }
  if (opts.source && opts.source !== 'all') {
    where.push('source = ?');
    params.push(opts.source);
  }
  const order =
    opts.sort === 'velocity'
      ? 'velocity DESC, score DESC'
      : opts.sort === 'rank'
        ? 'rank IS NULL, rank ASC, score DESC'
        : 'score DESC, velocity DESC, rank IS NULL, rank ASC';
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY ${order} LIMIT ?`;
  const rows = getDb().prepare(sql).all(...(params as never[]), limit) as unknown[];
  return rows.map((r) => rowToProduct(plain<ProductRow>(r)));
}

export function productCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number };
  return Number(row.c);
}

/* ------------------------------------------------------------------ series */

export function replaceSeries(keyword: string, nicheSlug: string | null, points: SeriesPoint[]): void {
  const db = getDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM series WHERE keyword = ?').run(keyword);
    const stmt = db.prepare('INSERT INTO series (keyword, niche_slug, t, v, source) VALUES (?,?,?,?,?)');
    for (const p of points) stmt.run(keyword, nicheSlug, p.t, p.v, 'google_trends');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getSeries(keyword: string): SeriesPoint[] {
  const rows = getDb()
    .prepare('SELECT t, v FROM series WHERE keyword = ? ORDER BY t ASC')
    .all(keyword) as unknown[];
  return rows.map((r) => {
    const row = plain<{ t: string; v: number }>(r);
    return { t: row.t, v: row.v };
  });
}

export function listSeriesKeywords(): string[] {
  const rows = getDb().prepare('SELECT DISTINCT keyword FROM series').all() as unknown[];
  return rows.map((r) => plain<{ keyword: string }>(r).keyword);
}

export function seriesCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM series').get() as { c: number };
  return Number(row.c);
}

/** Ensure every niche keyword has a series (seed if the live source never ran). */
export function ensureSeedSeries(): number {
  let created = 0;
  for (const n of NICHE_SEEDS) {
    for (const kw of n.keywords) {
      if (getSeries(kw).length === 0) {
        replaceSeries(kw, n.slug, seriesFromSeed(kw));
        created++;
      }
    }
  }
  return created;
}

export function allTrendSeries(): TrendSeries[] {
  const out: TrendSeries[] = [];
  for (const n of listNiches()) {
    for (const kw of n.keywords) {
      const points = getSeries(kw);
      if (points.length < 2) continue;
      const latest = points[points.length - 1].v;
      const prior = points[Math.max(0, points.length - 2)].v;
      const wowChange = prior === 0 ? 0 : Number((((latest - prior) / prior) * 100).toFixed(1));
      out.push({
        keyword: kw,
        nicheSlug: n.slug,
        points,
        latest,
        wowChange,
        source: 'google_trends',
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------ source health */

export function recordHealth(
  source: SourceId,
  patch: {
    status: SourceStatus;
    error?: string | null;
    itemCount?: number;
    ok?: boolean;
  },
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const prev = db.prepare('SELECT * FROM source_health WHERE source = ?').get(source) as
    | { consecutive_failures: number }
    | undefined;

  const failures = patch.ok ? 0 : (prev?.consecutive_failures ?? 0) + 1;

  db.prepare(
    `INSERT INTO source_health (source, status, last_attempt_at, last_ok_at, last_error, consecutive_failures, item_count)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(source) DO UPDATE SET
       status=excluded.status,
       last_attempt_at=excluded.last_attempt_at,
       last_ok_at=COALESCE(CASE WHEN ? = 1 THEN excluded.last_attempt_at END, source_health.last_ok_at),
       last_error=excluded.last_error,
       consecutive_failures=excluded.consecutive_failures,
       item_count=excluded.item_count`,
  ).run(
    source,
    patch.status,
    now,
    patch.ok ? now : null,
    patch.error ?? null,
    failures,
    patch.itemCount ?? 0,
    patch.ok ? 1 : 0,
  );
}

export function listHealth(): SourceHealth[] {
  const rows = getDb().prepare('SELECT * FROM source_health').all() as unknown[];
  return rows.map((r) => {
    const row = plain<{
      source: string;
      status: string;
      last_ok_at: string | null;
      last_attempt_at: string | null;
      last_error: string | null;
      consecutive_failures: number;
      item_count: number;
    }>(r);
    return {
      source: row.source as SourceId,
      status: row.status as SourceStatus,
      lastOkAt: row.last_ok_at,
      lastAttemptAt: row.last_attempt_at,
      lastError: row.last_error,
      consecutiveFailures: row.consecutive_failures,
      itemCount: row.item_count,
    };
  });
}

/* ------------------------------------------------------------------- stats */

export function getStats(): Stats {
  const refreshes = Number(getMeta('refreshes_today') ?? '0');
  const lastRefresh = getMeta('last_refresh_at');
  const niches = nicheCount();
  const avgRow = getDb().prepare('SELECT AVG(score) AS a FROM niches').get() as { a: number | null };
  return {
    nichesTracked: niches,
    productsTracked: productCount(),
    dataPoints: seriesCount(),
    avgOpportunity: Number((avgRow.a ?? 0).toFixed(1)),
    refreshesToday: refreshes,
    lastRefreshAt: lastRefresh,
  };
}

export function bumpRefreshCounter(): void {
  const today = new Date().toISOString().slice(0, 10);
  const day = getMeta('refresh_day');
  const count = day === today ? Number(getMeta('refreshes_today') ?? '0') + 1 : 1;
  if (day !== today) setMeta('refresh_day', today);
  setMeta('refreshes_today', String(count));
  setMeta('last_refresh_at', new Date().toISOString());
}

export const refreshLog: RefreshEvent[] = [];

export function logRefresh(ev: RefreshEvent): void {
  refreshLog.unshift(ev);
  if (refreshLog.length > 40) refreshLog.pop();
}
