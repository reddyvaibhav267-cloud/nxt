import { Router } from 'express';
import {
  allTrendSeries,
  getNiche,
  getSeries,
  getStats,
  listHealth,
  listNiches,
  listProducts,
  refreshLog,
} from '../db/repo.js';
import { SOURCE_LABELS, type ApiEnvelope } from '../types.js';

export const api = Router();

function envelope<T>(data: T, fallback: boolean): ApiEnvelope<T> {
  return {
    ok: true,
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      fallback,
      sources: listHealth(),
    },
  };
}

/** True when every live source is down/absent — client shows a "sampled" badge. */
function usingFallback(): boolean {
  const health = listHealth();
  if (health.length === 0) return true;
  return health.every((h) => h.status === 'fallback' || h.status === 'degraded');
}

api.get('/stats', (_req, res) => {
  res.json(envelope(getStats(), usingFallback()));
});

api.get('/health', (_req, res) => {
  res.json(envelope({ sources: listHealth(), recent: refreshLog.slice(0, 12) }, usingFallback()));
});

api.get('/niches', (req, res) => {
  let niches = listNiches();
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  if (category) niches = niches.filter((n) => n.category === category);
  res.json(envelope(niches, usingFallback()));
});

api.get('/niches/:slug', (req, res) => {
  const niche = getNiche(req.params.slug);
  if (!niche) {
    res.status(404).json({ ok: false, error: `niche not found: ${req.params.slug}` });
    return;
  }
  const series = niche.keywords
    .map((kw) => {
      const points = getSeries(kw);
      if (points.length < 2) return null;
      const latest = points[points.length - 1].v;
      const prior = points[Math.max(0, points.length - 2)].v;
      return {
        keyword: kw,
        points,
        latest,
        wowChange: prior === 0 ? 0 : Number((((latest - prior) / prior) * 100).toFixed(1)),
        source: 'google_trends' as const,
      };
    })
    .filter(Boolean);

  const products = listProducts({ niche: niche.slug, limit: 24 });
  // Same-category siblings first, then nearest-by-score so single-niche
  // categories still surface a meaningful "related" set.
  const siblings = listNiches().filter(
    (n) => n.slug !== niche.slug && n.category === niche.category,
  );
  const fill = listNiches()
    .filter((n) => n.slug !== niche.slug && n.category !== niche.category)
    .sort(
      (a, b) =>
        Math.abs(a.score - niche.score) - Math.abs(b.score - niche.score) ||
        Math.abs(a.demandIndex - niche.demandIndex) -
          Math.abs(b.demandIndex - niche.demandIndex),
    );
  const related = [...siblings, ...fill].slice(0, 4);

  res.json(envelope({ niche, series, products, related }, usingFallback()));
});

api.get('/products', (req, res) => {
  const sortParam = typeof req.query.sort === 'string' ? req.query.sort : 'score';
  const sort = sortParam === 'velocity' || sortParam === 'rank' ? sortParam : 'score';
  const niche = typeof req.query.niche === 'string' ? req.query.niche : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : 'all';
  const limit = Number(req.query.limit ?? 60);

  res.json(
    envelope(listProducts({ niche, source, sort, limit }), usingFallback()),
  );
});

api.get('/trends', (req, res) => {
  const niche = typeof req.query.niche === 'string' ? req.query.niche : null;
  let series = allTrendSeries();
  if (niche) series = series.filter((s) => s.nicheSlug === niche);
  res.json(envelope(series, usingFallback()));
});

api.get('/sources', (_req, res) => {
  res.json(
    envelope(
      listHealth().map((h) => ({ ...h, label: SOURCE_LABELS[h.source] })),
      usingFallback(),
    ),
  );
});

api.get('/events', (_req, res) => {
  res.json(envelope(refreshLog.slice(0, 20), usingFallback()));
});
