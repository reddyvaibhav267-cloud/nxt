import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { SeriesPoint } from '../api/types';
import { Reveal } from '../components/motion/Reveal';
import { Counter } from '../components/motion/Counter';
import { TrendOrb } from '../components/three/TrendOrb';
import { NodeFlowView } from '../components/graph/NodeFlowView';

type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGES: { key: RangeKey; days: number | null; label: string }[] = [
  { key: '7d', days: 7, label: '7d' },
  { key: '30d', days: 30, label: '30d' },
  { key: '90d', days: 90, label: '90d' },
  { key: 'all', days: null, label: 'all' },
];

export default function NicheDetail() {
  const { slug = '' } = useParams();
  const [range, setRange] = useState<RangeKey>('30d');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['niche', slug],
    queryFn: ({ signal }) => api.niche(slug, signal),
    enabled: Boolean(slug),
    refetchInterval: 60_000,
  });

  const { data: allNichesRes } = useQuery({
    queryKey: ['niches'],
    queryFn: ({ signal }) => api.niches(signal),
    refetchInterval: 60_000,
  });

  const { data: sourcesRes } = useQuery({
    queryKey: ['sources'],
    queryFn: ({ signal }) => api.sources(signal),
    refetchInterval: 60_000,
  });

  const detail = data?.data;
  const niche = detail?.niche;
  const products = detail?.products ?? [];
  const seriesList = detail?.series ?? [];

  // Primary chart series: first keyword series (server orders by relevance).
  const primary = seriesList[0];

  const points = useMemo<SeriesPoint[]>(() => {
    if (!primary?.points?.length) return [];
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    if (!days) return primary.points;
    const cutoff = Date.now() - days * 86_400_000;
    const sliced = primary.points.filter((p) => new Date(p.t).getTime() >= cutoff);
    return sliced.length >= 2 ? sliced : primary.points;
  }, [primary, range]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70svh] items-center justify-center pt-16">
        <span className="mono-label">loading niche…</span>
      </div>
    );
  }

  if (isError || !detail || !niche) {
    return (
      <div className="flex min-h-[70svh] flex-col items-center justify-center gap-5 pt-16">
        <p className="display-md text-bone">niche not found</p>
        <Link
          to="/niches"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-lime"
        >
          ← back to niches
        </Link>
      </div>
    );
  }

  const growth = niche.wowGrowth;
  const graphNiches = allNichesRes?.data ?? [niche];

  return (
    <div className="min-h-svh pt-16 md:pt-[72px]">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-25" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 55% 100% at 85% 30%, rgba(215,255,62,0.07), transparent 65%)',
          }}
        />

        <div className="relative mx-auto max-w-[1600px] px-5 pb-10 pt-8 md:px-8 md:pb-14 md:pt-12">
          <nav className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
            <Link to="/niches" className="transition-colors hover:text-lime">
              niches
            </Link>
            <span>/</span>
            <span className="text-mist">{niche.slug}</span>
          </nav>

          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr] md:gap-12">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-line-bright px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
                  {niche.category}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                    niche.score >= 70
                      ? 'border-lime/40 text-lime'
                      : niche.score >= 50
                        ? 'border-line-bright text-mist'
                        : 'border-signal/40 text-signal'
                  }`}
                >
                  score {niche.score}
                </span>
                {niche.marginBand && (
                  <span className="rounded-full border border-line-bright px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fog">
                    margin · {niche.marginBand}
                  </span>
                )}
              </div>

              <h1 className="display-lg mt-4 text-bone">{niche.name}</h1>

              {niche.description && (
                <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-mist md:text-base">
                  {niche.description}
                </p>
              )}

              <div className="mt-7 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
                <Metric label="opportunity" value={niche.score} accent />
                <Metric label="demand index" value={niche.demandIndex} />
                <Metric
                  label="wow growth"
                  value={growth}
                  suffix="%"
                  danger={growth < 0}
                />
                <Metric label="products" value={niche.productCount} />
              </div>
            </div>

            <div className="relative hidden md:block">
              <div className="relative h-full min-h-[260px]">
                <TrendOrb score={niche.score} className="absolute inset-0" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-extrabold tracking-[-0.05em] text-bone">
                    <Counter value={niche.score} />
                  </span>
                  <span className="mono-label !text-[9px]">opportunity</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chart */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mono-label mb-2">
                trend history{primary ? ` · ${primary.keyword}` : ''}
              </p>
              <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
                demand over time
              </h2>
            </div>
            <div className="flex gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                    range === r.key
                      ? 'border-lime bg-lime text-void'
                      : 'border-line-bright text-mist hover:border-lime/40 hover:text-bone'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <Reveal>
            <div className="rounded-lg border border-line bg-panel/30 p-4 md:p-6">
              {points.length < 2 ? (
                <p className="py-16 text-center font-mono text-[11px] text-fog">
                  not enough history for this range
                </p>
              ) : (
                <TrendChart points={points} />
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Product graph */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mono-label mb-2">product graph</p>
              <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
                trace a product
              </h2>
            </div>
            <p className="max-w-[46ch] text-sm leading-relaxed text-mist">
              Sources feed the category, the category rolls up into niches,
              this niche fans out to products — click one for its trend.
            </p>
          </div>
          <NodeFlowView
            niches={graphNiches}
            products={products}
            health={sourcesRes?.data ?? []}
            focusSlug={niche.slug}
            series={points}
            seriesKeyword={primary?.keyword}
          />
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono-label mb-2">ranked products</p>
            <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
              what's moving
            </h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
            {products.length} products
          </span>
        </div>

        {products.length === 0 ? (
          <p className="rounded-lg border border-line py-16 text-center font-mono text-[11px] text-fog">
            no products indexed for this niche yet
          </p>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain border border-line">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-panel">
                  {['rank', 'product', 'source', 'price', 'score', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-fog"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="group border-b border-line last:border-0 transition-colors hover:bg-panel/60"
                  >
                    <td className="px-4 py-3.5 font-mono text-[11px] tabular text-lime">
                      {p.rank != null ? String(p.rank).padStart(2, '0') : '—'}
                    </td>
                    <td className="max-w-[340px] px-4 py-3.5">
                      <p className="truncate text-sm font-medium text-bone">{p.title}</p>
                      <p className="font-mono text-[10px] text-fog">
                        {p.metricLabel}: {p.metricValue}
                        {p.rankDelta != null && p.rankDelta !== 0 && (
                          <span className={p.rankDelta > 0 ? 'text-lime' : 'text-signal'}>
                            {' '}
                            · {p.rankDelta > 0 ? '▲' : '▼'}
                            {Math.abs(p.rankDelta)}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-mist">
                      {p.source}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[12px] tabular text-bone">
                      {p.priceUsd != null ? `$${p.priceUsd.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-mono text-[12px] tabular ${
                          p.score >= 60 ? 'text-lime' : 'text-mist'
                        }`}
                      >
                        {p.score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog transition-colors hover:text-lime"
                        >
                          open →
                        </a>
                      ) : (
                        <span className="font-mono text-[10px] text-fog">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Related */}
      {detail.related.length > 0 && (
        <section className="border-t border-line bg-ink">
          <div className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
            <p className="mono-label mb-5">related niches</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {detail.related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/niches/${r.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-panel/40 px-4 py-4 transition-all hover:border-lime/40"
                >
                  <div>
                    <p className="text-sm font-bold text-bone transition-colors group-hover:text-lime">
                      {r.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">
                      {r.category}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold tabular text-lime">
                    {r.score}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix = '',
  accent = false,
  danger = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-void px-4 py-4">
      <p className="mono-label mb-1.5 !text-[9px]">{label}</p>
      <p
        className={`text-2xl font-extrabold tracking-[-0.04em] tabular md:text-3xl ${
          danger ? 'text-signal' : accent ? 'text-lime' : 'text-bone'
        }`}
      >
        <Counter
          value={value}
          decimals={Number.isInteger(value) ? 0 : 1}
          suffix={suffix}
        />
      </p>
    </div>
  );
}

/** Pure SVG line chart — no chart library needed. */
function TrendChart({ points }: { points: SeriesPoint[] }) {
  const W = 1000;
  const H = 320;
  const PAD = { t: 24, r: 16, b: 36, l: 44 };

  const values = points.map((p) => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) =>
    PAD.l + (i / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) =>
    PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${H - PAD.b} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = min + t * span;
    return { y: y(v), label: Math.round(v) };
  });

  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Trend history chart"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d7ff3e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#d7ff3e" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={g.y}
            y2={g.y}
            stroke="#2c3238"
            strokeWidth="1"
            strokeDasharray={i === 0 ? '0' : '3 5'}
          />
          <text
            x={PAD.l - 8}
            y={g.y + 4}
            textAnchor="end"
            fill="#6b7280"
            fontSize="12"
            fontFamily="ui-monospace, monospace"
          >
            {g.label}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="#d7ff3e" strokeWidth="2.5" strokeLinejoin="round" />

      <circle
        cx={x(points.length - 1)}
        cy={y(values[values.length - 1])}
        r="5"
        fill="#d7ff3e"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(values[values.length - 1])}
        r="10"
        fill="none"
        stroke="#d7ff3e"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />

      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 10}
          textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          fill="#6b7280"
          fontSize="12"
          fontFamily="ui-monospace, monospace"
        >
          {fmt(points[i].t)}
        </text>
      ))}
    </svg>
  );
}
