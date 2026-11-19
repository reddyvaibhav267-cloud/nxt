import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Niche, Product, SeriesPoint, SourceHealth, SourceId } from '../../api/types';

interface Props {
  niches: Niche[];
  products?: Product[];
  health?: SourceHealth[];
  className?: string;
  /** Scope the graph to a single category (niches list filter). */
  category?: string;
  /** Scope to one niche: appends its products as a 4th column + trend panel. */
  focusSlug?: string;
  /** Demand series for the focus niche — powers the product trend panel. */
  series?: SeriesPoint[];
  seriesKeyword?: string;
}

interface GraphNode {
  key: string;
  col: 0 | 1 | 2 | 3;
  x: number;
  y: number;
  r: number;
  label: string;
  color: string;
  slug?: string;
  productId?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  d: string;
}

const SOURCE_ORDER: SourceId[] = ['google_trends', 'amazon', 'tiktok'];
const SOURCE_LABELS: Record<string, string> = {
  google_trends: 'google trends',
  amazon: 'amazon',
  tiktok: 'tiktok',
};

const COL_3 = [96, 540, 964];
const COL_4 = [80, 430, 770, 1100];
const PAD = 54;

function statusColor(status?: string): string {
  if (status === 'live') return '#d7ff3e';
  if (status === 'degraded') return '#ff4d2e';
  return '#6b7480';
}

function scoreColor(score: number): string {
  if (score >= 70) return '#d7ff3e';
  if (score >= 50) return '#e8d44d';
  return '#ff4d2e';
}

function distribute(count: number, height: number): number[] {
  const span = height - PAD * 2;
  return Array.from({ length: count }, (_, i) =>
    count === 1 ? height / 2 : PAD + ((i + 0.5) * span) / count,
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Animated signal graph: sources → categories → niches (→ products when a
 * focus niche is set). Edges flow, live sources pulse, hovering a node
 * highlights its neighbourhood, clicking a niche opens its detail page and
 * clicking a product reveals its demand trend.
 */
export function NodeFlowView({
  niches,
  products = [],
  health = [],
  className = '',
  category,
  focusSlug,
  series,
  seriesKeyword,
}: Props) {
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setActive(null);
    setSelectedId(null);
  }, [focusSlug, category]);

  const { nodes, edges, adjacency, sourceKeys, categoryCount, focusProducts, productById } =
    useMemo(() => {
      // ---- scope ------------------------------------------------------
      const focusNiche = focusSlug ? niches.find((n) => n.slug === focusSlug) : undefined;
      const scopedCategory = focusNiche?.category ?? category;

      let scopedNiches = niches;
      if (scopedCategory) scopedNiches = niches.filter((n) => n.category === scopedCategory);
      const categories = scopedCategory
        ? [scopedCategory]
        : Array.from(new Set(niches.map((n) => n.category))).sort();

      const focusList = focusNiche
        ? products.filter((p) => p.nicheSlug === focusNiche.slug).slice(0, 8)
        : [];
      const hasProducts = focusList.length > 0;

      const colX = hasProducts ? COL_4 : COL_3;
      const height = Math.max(
        420,
        Math.max(scopedNiches.length, categories.length, focusList.length, 3) * 36 + 40,
      );

      // ---- nodes ------------------------------------------------------
      const healthBySource = new Map(health.map((h) => [h.source, h]));
      const sourceY = distribute(SOURCE_ORDER.length, height);
      const categoryY = distribute(categories.length, height);
      const nicheY = distribute(scopedNiches.length, height);
      const productY = distribute(focusList.length, height);

      const nodes: GraphNode[] = [];

      SOURCE_ORDER.forEach((s, i) => {
        nodes.push({
          key: `s:${s}`,
          col: 0,
          x: colX[0],
          y: sourceY[i],
          r: 9,
          label: SOURCE_LABELS[s] ?? s.replace(/_/g, ' '),
          color: statusColor(healthBySource.get(s)?.status),
        });
      });

      const nichesByCategory = new Map<string, Niche[]>();
      for (const n of niches) {
        const list = nichesByCategory.get(n.category) ?? [];
        list.push(n);
        nichesByCategory.set(n.category, list);
      }

      categories.forEach((c, i) => {
        const count = nichesByCategory.get(c)?.length ?? 0;
        nodes.push({
          key: `c:${c}`,
          col: 1,
          x: colX[1],
          y: categoryY[i],
          r: 7 + Math.min(count, 6),
          label: c,
          color: '#2c3238',
        });
      });

      const sortedNiches = [...scopedNiches].sort(
        (a, b) => b.score - a.score || a.name.localeCompare(b.name),
      );
      sortedNiches.forEach((n, i) => {
        nodes.push({
          key: `n:${n.slug}`,
          col: 2,
          x: colX[2],
          y: nicheY[i],
          r: 4.5 + n.score / 22,
          label: n.name,
          color: scoreColor(n.score),
          slug: n.slug,
        });
      });

      const productById = new Map(focusList.map((p) => [p.id, p]));
      focusList.forEach((p, i) => {
        nodes.push({
          key: `p:${p.id}`,
          col: 3,
          x: colX[3],
          y: productY[i],
          r: 4 + p.score / 24,
          label: truncate(p.title, 26),
          color: scoreColor(p.score),
          productId: p.id,
        });
      });

      // ---- edges ------------------------------------------------------
      const catBySlug = new Map(niches.map((n) => [n.slug, n.category]));
      const evidence = new Map<string, Set<string>>();
      for (const p of products) {
        const cat = catBySlug.get(p.nicheSlug);
        if (!cat) continue;
        const set = evidence.get(p.source) ?? new Set<string>();
        set.add(cat);
        evidence.set(p.source, set);
      }

      const edges: GraphEdge[] = [];
      const adjacency = new Map<string, Set<string>>();
      const link = (a: string, b: string) => {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
      };

      const curve = (x1: number, y1: number, x2: number, y2: number) => {
        const dx = (x2 - x1) * 0.55;
        return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      };

      const nodeByKey = new Map(nodes.map((n) => [n.key, n]));

      // source → category (evidence-based; a source with no rows fans out)
      for (const s of SOURCE_ORDER) {
        const cats = evidence.get(s);
        const targets = cats && cats.size > 0 ? [...cats] : categories;
        for (const c of targets) {
          const a = nodeByKey.get(`s:${s}`);
          const b = nodeByKey.get(`c:${c}`);
          if (!a || !b) continue;
          edges.push({ id: `e:s:${s}::${c}`, from: `s:${s}`, to: `c:${c}`, d: curve(a.x + a.r, a.y, b.x - b.r, b.y) });
          link(`s:${s}`, `c:${c}`);
        }
      }

      // category → niche
      for (const n of sortedNiches) {
        const a = nodeByKey.get(`c:${n.category}`);
        const b = nodeByKey.get(`n:${n.slug}`);
        if (!a || !b) continue;
        edges.push({ id: `e:c:${n.category}::${n.slug}`, from: `c:${n.category}`, to: `n:${n.slug}`, d: curve(a.x + a.r, a.y, b.x - b.r, b.y) });
        link(`c:${n.category}`, `n:${n.slug}`);
      }

      // focus niche → products
      if (focusNiche && hasProducts) {
        const a = nodeByKey.get(`n:${focusNiche.slug}`);
        for (const p of focusList) {
          const b = nodeByKey.get(`p:${p.id}`);
          if (!a || !b) continue;
          edges.push({ id: `e:p:${p.id}`, from: `n:${focusNiche.slug}`, to: `p:${p.id}`, d: curve(a.x + a.r, a.y, b.x - b.r, b.y) });
          link(`n:${focusNiche.slug}`, `p:${p.id}`);
        }
      }

      return {
        nodes,
        edges,
        adjacency,
        sourceKeys: SOURCE_ORDER,
        categoryCount: categories.length,
        focusProducts: focusList,
        productById,
      };
    }, [niches, products, health, category, focusSlug]);

  // Two-hop neighbourhood of the hovered node.
  const highlight = useMemo(() => {
    if (!active) return null;
    const depth1 = adjacency.get(active);
    if (!depth1) return new Set([active]);
    const set = new Set<string>([active, ...depth1]);
    for (const k of depth1) {
      const depth2 = adjacency.get(k);
      if (depth2) for (const d of depth2) set.add(d);
    }
    return set;
  }, [active, adjacency]);

  const isOn = (key: string) => !highlight || highlight.has(key);

  const selected = selectedId ? productById.get(selectedId) ?? null : null;
  const showProducts = focusProducts.length > 0;
  const width = showProducts ? 1260 : 1080;
  const height = Math.max(...nodes.map((n) => n.y)) + PAD;
  const captions = showProducts
    ? ['sources', 'categories', 'niches', 'products']
    : ['sources', 'categories', 'niches'];
  const colX = showProducts ? COL_4 : COL_3;

  return (
    <div className={className}>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fog">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-lime" /> live source
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-signal" /> degraded
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: '#e8d44d' }} /> mid score
        </span>
        <span className="hidden sm:inline">
          {sourceKeys.length} sources · {categoryCount} categories ·{' '}
          {nodes.filter((n) => n.col === 2).length} niches
          {showProducts ? ` · ${focusProducts.length} products` : ''}
        </span>
        <span className="ml-auto hidden md:inline">
          {showProducts ? 'click a product for its trend' : 'hover to trace · click a niche to open'}
        </span>
        <span className="ml-auto sm:hidden">
          {showProducts ? 'swipe ↔ · tap a product' : 'swipe ↔ to explore'}
        </span>
      </div>

      {/* Canvas */}
      <div className="relative overflow-auto overscroll-x-contain rounded-lg border border-line bg-panel/30">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Signal graph: sources flowing into categories, niches and products"
          className="block min-w-[860px]"
          onMouseLeave={() => setActive(null)}
        >
          {/* Column captions */}
          {captions.map((label, i) => (
            <text
              key={label}
              x={colX[i]}
              y={24}
              textAnchor="middle"
              fill="#6b7480"
              fontSize="11"
              letterSpacing="2"
              fontFamily="ui-monospace, monospace"
            >
              {label.toUpperCase()}
            </text>
          ))}

          {/* Edges */}
          <g fill="none">
            {edges.map((e) => {
              const on = isOn(e.from) && isOn(e.to);
              return (
                <path
                  key={e.id}
                  d={e.d}
                  stroke={on && highlight ? '#d7ff3e' : '#2c3238'}
                  strokeWidth={on && highlight ? 1.6 : 1}
                  opacity={on ? (highlight ? 0.95 : 0.55) : 0.08}
                  className="edge-flow"
                  style={{ animationDelay: `${(e.id.length % 7) * 0.14}s` }}
                />
              );
            })}
          </g>

          {/* Nodes */}
          {nodes.map((n, i) => {
            const on = isOn(n.key);
            const isSource = n.col === 0;
            const live = isSource && n.color === '#d7ff3e';
            const isSelected = Boolean(n.productId && n.productId === selectedId);
            return (
              <g
                key={n.key}
                opacity={on ? 1 : 0.22}
                className={n.col >= 2 ? 'node-bob cursor-pointer' : ''}
                style={{ animationDelay: `${(i % 9) * 0.5}s` }}
                onMouseEnter={() => setActive(n.key)}
                onFocus={() => setActive(n.key)}
                onClick={() => {
                  if (n.slug) navigate(`/niches/${n.slug}`);
                  else if (n.productId) {
                    setSelectedId(n.productId);
                    setActive(n.key);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  if (n.slug) navigate(`/niches/${n.slug}`);
                  else if (n.productId) setSelectedId(n.productId);
                }}
                tabIndex={n.slug || n.productId ? 0 : -1}
                role={n.slug ? 'link' : n.productId ? 'button' : undefined}
                aria-label={n.slug ? `Open ${n.label}` : n.productId ? `Trend for ${n.label}` : n.label}
              >
                {live && (
                  <circle cx={n.x} cy={n.y} r={n.r + 7} fill="#d7ff3e" opacity={0.16} className="live-halo" />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.col === 1 ? '#111417' : n.color}
                  stroke={isSelected ? '#ededed' : n.col === 1 ? '#3a424a' : 'none'}
                  strokeWidth={isSelected ? 2 : n.col === 1 ? 1.5 : 0}
                />
                {n.col === 1 && (
                  <circle cx={n.x} cy={n.y} r={Math.max(2.5, n.r - 6)} fill="#d7ff3e" opacity={0.85} />
                )}
                <text
                  x={n.x}
                  y={n.y - n.r - 7}
                  textAnchor="middle"
                  fill={n.col === 2 || n.col === 3 ? '#ededed' : '#9aa4af'}
                  fontSize={n.col === 1 ? 11 : 10.5}
                  fontFamily="ui-monospace, monospace"
                  letterSpacing="0.06em"
                >
                  {n.col === 0 ? n.label.toUpperCase() : n.label}
                </text>
                <title>
                  {n.col === 3
                    ? `${n.label} — show trend`
                    : n.col === 2
                      ? `${n.label} — open niche`
                      : n.col === 1
                        ? `${n.label} — category`
                        : `${n.label} — source`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Product trend panel — outside the scroll container so it stays
          visible while the graph is panned horizontally. */}
      {showProducts && (
        <div className="rounded-b-lg border border-t-0 border-line bg-void/60 p-4 md:p-5">
            {selected ? (
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-[240px] flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-line-bright px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
                      {selected.source.replace(/_/g, ' ')}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 font-mono text-[10px] tabular tracking-[0.1em]"
                      style={{
                        background: scoreColor(selected.score) + '22',
                        color: scoreColor(selected.score),
                      }}
                    >
                      score {selected.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="ml-auto font-mono text-[11px] text-fog transition-colors hover:text-bone"
                      aria-label="Close product trend"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-bone">{selected.title}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[11px] text-mist">
                    <span>price · {selected.priceUsd != null ? `$${selected.priceUsd.toFixed(2)}` : '—'}</span>
                    <span>velocity · {selected.velocity}</span>
                    <span>rank · {selected.rank ?? '—'}</span>
                    <span>
                      rank Δ ·{' '}
                      <span
                        className={
                          selected.rankDelta == null
                            ? ''
                            : selected.rankDelta > 0
                              ? 'text-lime'
                              : selected.rankDelta < 0
                                ? 'text-signal'
                                : ''
                        }
                      >
                        {selected.rankDelta == null
                          ? '—'
                          : selected.rankDelta > 0
                            ? `▲${selected.rankDelta}`
                            : selected.rankDelta < 0
                              ? `▼${Math.abs(selected.rankDelta)}`
                              : '0'}
                      </span>
                    </span>
                    <span>
                      {selected.metricLabel} ·{' '}
                      {selected.metricValue.toLocaleString('en-US')}
                    </span>
                    <span>observed · {new Date(selected.observedAt).toLocaleDateString()}</span>
                  </div>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-lime transition-colors hover:text-bone"
                    >
                      open listing ↗
                    </a>
                  )}
                </div>

                <div className="min-w-[240px] flex-1 md:max-w-[440px]">
                  <p className="mono-label mb-2">
                    demand trend{seriesKeyword ? ` · ${seriesKeyword}` : ''}
                  </p>
                  <Sparkline points={series ?? []} />
                </div>
              </div>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
                click a product node to see its trend →
              </p>
            )}
          </div>
        )}
    </div>
  );
}

/** Compact SVG sparkline for the product trend panel. */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="rounded border border-line py-6 text-center font-mono text-[11px] text-fog">
        no trend data for this range
      </p>
    );
  }

  const W = 440;
  const H = 96;
  const P = 8;
  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;

  const first = new Date(points[0].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const last = new Date(points[points.length - 1].t).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Demand trend sparkline"
      >
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7ff3e" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#d7ff3e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" />
        <path
          d={line}
          fill="none"
          stroke="#d7ff3e"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(points.length - 1)} cy={y(values[values.length - 1])} r="3.5" fill="#d7ff3e" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-fog">
        <span>{first}</span>
        <span className="tabular text-mist">now · {values[values.length - 1]}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
