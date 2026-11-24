import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Counter } from '../components/motion/Counter';
import { TrendOrb } from '../components/three/TrendOrb';
import { NodeFlowView } from '../components/graph/NodeFlowView';
import { useRefreshStream } from '../hooks/useRefreshStream';
import { onRefreshEvent } from '../api/stream';

type SortKey = 'opportunity' | 'demand' | 'growth' | 'name';

export default function Dashboard() {
  const [sort, setSort] = useState<SortKey>('opportunity');
  const [query, setQuery] = useState('');

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => api.stats(signal),
    refetchInterval: 45_000,
  });

  const { data: nichesRes, isLoading: nichesLoading } = useQuery({
    queryKey: ['niches'],
    queryFn: ({ signal }) => api.niches(signal),
    refetchInterval: 60_000,
  });

  const { data: sourcesRes } = useQuery({
    queryKey: ['sources'],
    queryFn: ({ signal }) => api.sources(signal),
    refetchInterval: 45_000,
  });

  const { data: productsRes } = useQuery({
    queryKey: ['products', 'graph'],
    queryFn: ({ signal }) => api.products({ limit: 200 }, signal),
    refetchInterval: 120_000,
  });

  const { connected, events } = useRefreshStream();
  const lastEvent = events[0];

  // "refresh now" kicks off a server-side scrape (POST /api/refresh) which
  // streams results back over SSE — the button stays busy until the first
  // refresh event lands, so it never looks like a dead click.
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (!syncing) return;
    const off = onRefreshEvent(() => setSyncing(false));
    const fallback = setTimeout(() => setSyncing(false), 60_000);
    return () => {
      off();
      clearTimeout(fallback);
    };
  }, [syncing]);

  const triggerRefresh = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await api.refresh('all');
    } catch {
      setSyncing(false);
    }
  };

  const stats = statsRes?.data;
  const sources = sourcesRes?.data ?? [];
  const liveCount = sources.filter((s) => s.status === 'live').length;

  const niches = useMemo(() => {
    const list = [...(nichesRes?.data ?? [])];
    const q = query.trim().toLowerCase();
    let filtered = q
      ? list.filter(
          (n) =>
            n.name.toLowerCase().includes(q) ||
            n.slug.includes(q) ||
            n.category.toLowerCase().includes(q),
        )
      : list;

    filtered.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'demand':
          return b.demandIndex - a.demandIndex;
        case 'growth':
          return b.wowGrowth - a.wowGrowth;
        case 'opportunity':
        default:
          return b.score - a.score;
      }
    });
    return filtered;
  }, [nichesRes, sort, query]);

  const topNiche = nichesRes?.data?.[0];
  const avgScore = stats?.avgOpportunity ?? 0;

  return (
    <div className="min-h-svh pt-16 md:pt-[72px]">
      {/* Page head */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 pb-8 pt-10 md:px-8 md:pb-10 md:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mono-label mb-3">02 / dashboard</p>
              <h1 className="display-lg text-bone">
                trend<span className="text-lime">.</span>room
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* SSE status */}
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  connected
                    ? 'border-lime/35 pill-live text-lime'
                    : 'border-line-bright text-fog'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-lime' : 'bg-fog'}`}
                  style={connected ? { animation: 'pulse 1.8s ease-in-out infinite' } : undefined}
                />
                {connected ? 'stream connected' : 'stream idle'}
              </span>
              <button
                type="button"
                onClick={() => void triggerRefresh()}
                disabled={syncing}
                className="rounded-full border border-line-bright px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist transition-colors hover:border-lime/50 hover:text-bone disabled:cursor-wait disabled:opacity-60"
              >
                {syncing ? 'syncing…' : 'refresh now'}
              </button>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            <Cell label="niches" value={stats?.nichesTracked ?? 0} loading={statsLoading} />
            <Cell label="products" value={stats?.productsTracked ?? 0} loading={statsLoading} />
            <Cell label="data points" value={stats?.dataPoints ?? 0} loading={statsLoading} />
            <Cell
              label="avg opportunity"
              value={avgScore}
              loading={statsLoading}
              decimals={1}
              accent
            />
          </div>

          {lastEvent && (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-fog">
              last event · {lastEvent.source} · {new Date(lastEvent.at).toLocaleTimeString()}
              {lastEvent.status ? ` · ${lastEvent.status}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* Orb + sources */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1600px] gap-px bg-line md:grid-cols-[1.3fr_1fr]">
          <div className="bg-void px-5 py-8 md:px-8 md:py-10">
            <p className="mono-label mb-4">live signal · composite</p>
            <div className="flex flex-wrap items-center gap-8">
              <div className="relative h-52 w-52 shrink-0 md:h-64 md:w-64">
                <TrendOrb score={avgScore} className="absolute inset-0" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-extrabold tracking-[-0.05em] text-bone md:text-6xl">
                    <Counter value={avgScore} decimals={0} />
                  </span>
                  <span className="mono-label !text-[9px]">avg score</span>
                </div>
              </div>
              <div className="min-w-[200px] flex-1 space-y-4">
                <p className="max-w-[38ch] text-sm leading-relaxed text-mist">
                  The orb's turbulence maps to the average opportunity score
                  across all tracked niches. Hotter color = hotter demand.
                </p>
                <div className="space-y-2">
                  {sources.map((s) => (
                    <div
                      key={s.source}
                      className="flex items-center justify-between gap-4 border-b border-line pb-2"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
                        {s.source.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                          s.status === 'live'
                            ? 'text-lime'
                            : s.status === 'degraded'
                              ? 'text-signal'
                              : 'text-fog'
                        }`}
                      >
                        {s.status}
                        {typeof s.itemCount === 'number' ? ` · ${s.itemCount}` : ''}
                      </span>
                    </div>
                  ))}
                  {sources.length === 0 && (
                    <p className="font-mono text-[11px] text-fog">no source health yet</p>
                  )}
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog">
                  {liveCount}/{sources.length || 0} sources live
                </p>
              </div>
            </div>
          </div>

          {/* Spotlight niche */}
          <div className="bg-void px-5 py-8 md:px-8 md:py-10">
            <p className="mono-label mb-4">top opportunity right now</p>
            {topNiche ? (
              <div>
                <p className="text-2xl font-extrabold tracking-[-0.03em] text-bone md:text-3xl">
                  {topNiche.name}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
                  {topNiche.category}
                </p>
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <MiniStat label="score" value={topNiche.score} accent />
                  <MiniStat label="demand" value={topNiche.demandIndex} />
                  <MiniStat label="growth" value={topNiche.wowGrowth} suffix="%" />
                </div>
                <Link
                  to={`/niches/${topNiche.slug}`}
                  className="group mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-lime"
                >
                  open niche
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-fog">loading…</p>
            )}
          </div>
        </div>
      </section>

      {/* Signal graph */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mono-label mb-2">signal graph</p>
              <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
                everything, connected
              </h2>
            </div>
            <p className="max-w-[46ch] text-sm leading-relaxed text-mist">
              Live sources feed categories, categories roll up into niches.
              Hover or tap a node to trace its path — tap a niche to open it.
            </p>
          </div>
          <NodeFlowView
            niches={nichesRes?.data ?? []}
            products={productsRes?.data ?? []}
            health={sources}
          />
        </div>
      </section>

      {/* Table */}
      <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
            all niches
            <span className="ml-3 font-mono text-[11px] font-normal tracking-[0.14em] text-fog">
              {niches.length} shown
            </span>
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search niches…"
              className="h-10 w-44 rounded-full border border-line-bright bg-panel px-4 font-mono text-[16px] text-bone placeholder:text-fog focus:border-lime/50 focus:outline-none md:w-56 md:text-[11px]"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 rounded-full border border-line-bright bg-panel px-4 font-mono text-[16px] uppercase tracking-[0.1em] text-mist focus:border-lime/50 focus:outline-none md:text-[11px]"
              aria-label="Sort niches"
            >
              <option value="opportunity">sort · opportunity</option>
              <option value="demand">sort · demand</option>
              <option value="growth">sort · growth</option>
              <option value="name">sort · name</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto overscroll-x-contain border border-line">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-panel">
                {['#', 'niche', 'category', 'score', 'demand', 'growth', ''].map((h) => (
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
              {nichesLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-fog">
                    loading niches…
                  </td>
                </tr>
              )}
              {!nichesLoading && niches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-fog">
                    no niches match “{query}”
                  </td>
                </tr>
              )}
              {niches.map((n, i) => (
                <tr
                  key={n.slug}
                  className="group border-b border-line last:border-0 transition-colors hover:bg-panel/60"
                >
                  <td className="px-4 py-3.5 font-mono text-[11px] tabular text-fog">
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      to={`/niches/${n.slug}`}
                      className="text-sm font-semibold text-bone transition-colors group-hover:text-lime"
                    >
                      {n.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-mist">{n.category}</td>
                  <td className="px-4 py-3.5">
                    <ScoreBar value={n.score} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[12px] tabular text-bone">
                    {n.demandIndex}
                  </td>
                  <td
                    className={`px-4 py-3.5 font-mono text-[12px] tabular ${
                      n.wowGrowth >= 0 ? 'text-lime' : 'text-signal'
                    }`}
                  >
                    {n.wowGrowth >= 0 ? '+' : ''}
                    {n.wowGrowth.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      to={`/niches/${n.slug}`}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog transition-colors group-hover:text-lime"
                    >
                      view →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Cell({
  label,
  value,
  loading,
  decimals = 0,
  accent = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  decimals?: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-void px-4 py-5 md:px-6 md:py-6">
      <p className="mono-label mb-2 !text-[10px]">{label}</p>
      <p
        className={`text-3xl font-extrabold tracking-[-0.04em] md:text-[38px] ${
          accent ? 'text-lime' : 'text-bone'
        }`}
      >
        {loading ? (
          <span className="inline-block h-[1em] w-16 animate-pulse rounded bg-line" />
        ) : (
          <Counter value={value} decimals={decimals} />
        )}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  suffix = '',
  accent = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-line px-3 py-3">
      <p className="mono-label mb-1 !text-[9px]">{label}</p>
      <p
        className={`text-xl font-extrabold tracking-[-0.03em] tabular ${
          accent ? 'text-lime' : 'text-bone'
        }`}
      >
        <Counter value={value} suffix={suffix} />
      </p>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  const hue = value >= 70 ? '#d7ff3e' : value >= 50 ? '#e8d44d' : '#ff4d2e';
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line md:w-28">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${value}%`, background: hue }}
        />
      </div>
      <span className="font-mono text-[12px] tabular text-bone">{value}</span>
    </div>
  );
}
