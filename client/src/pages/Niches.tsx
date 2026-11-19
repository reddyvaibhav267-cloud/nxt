import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Reveal } from '../components/motion/Reveal';
import { Counter } from '../components/motion/Counter';
import { NodeFlowView } from '../components/graph/NodeFlowView';

export default function Niches() {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'score' | 'demand' | 'growth' | 'alpha'>('score');
  const [showGraph, setShowGraph] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['niches'],
    queryFn: ({ signal }) => api.niches(signal),
    refetchInterval: 60_000,
  });

  const { data: productsRes } = useQuery({
    queryKey: ['products', 'graph'],
    queryFn: ({ signal }) => api.products({ limit: 200 }, signal),
    refetchInterval: 120_000,
  });

  const { data: sourcesRes } = useQuery({
    queryKey: ['sources'],
    queryFn: ({ signal }) => api.sources(signal),
    refetchInterval: 60_000,
  });

  const niches = data?.data ?? [];

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of niches) counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [niches]);

  const filtered = useMemo(() => {
    let list =
      category === 'all' ? [...niches] : niches.filter((n) => n.category === category);
    list.sort((a, b) => {
      switch (sort) {
        case 'alpha':
          return a.name.localeCompare(b.name);
        case 'demand':
          return b.demandIndex - a.demandIndex;
        case 'growth':
          return b.wowGrowth - a.wowGrowth;
        case 'score':
        default:
          return b.score - a.score;
      }
    });
    return list;
  }, [niches, category, sort]);

  return (
    <div className="min-h-svh pt-16 md:pt-[72px]">
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-10 md:px-8 md:pb-12 md:pt-16">
          <p className="mono-label mb-3">03 / niches</p>
          <h1 className="display-lg max-w-[16ch] text-bone">
            every niche,
            <br />
            <span className="text-lime">scored</span>.
          </h1>
          <p className="mt-5 max-w-[54ch] text-sm leading-relaxed text-mist md:text-base">
            Each niche blends search demand, marketplace headroom, growth
            velocity and margin band into a single 0–100 opportunity score.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-30 border-b border-line bg-void/85 backdrop-blur-xl md:top-[72px]">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-5 py-3.5 md:px-8">
          <div className="-mx-1 flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto px-1 no-scrollbar md:flex-wrap md:overflow-visible">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                category === 'all'
                  ? 'border-lime bg-lime text-void'
                  : 'border-line-bright text-mist hover:border-lime/40 hover:text-bone'
              }`}
            >
              all <span className="opacity-60">{niches.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategory(c.name)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  category === c.name
                    ? 'border-lime bg-lime text-void'
                    : 'border-line-bright text-mist hover:border-lime/40 hover:text-bone'
                }`}
              >
                {c.name} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowGraph((v) => !v)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              showGraph
                ? 'border-lime/50 text-lime'
                : 'border-line-bright text-mist hover:border-lime/40 hover:text-bone'
            }`}
            aria-pressed={showGraph}
          >
            graph {showGraph ? 'on' : 'off'}
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 shrink-0 rounded-full border border-line-bright bg-panel px-4 font-mono text-[16px] uppercase tracking-[0.1em] text-mist focus:border-lime/50 focus:outline-none md:text-[11px]"
            aria-label="Sort"
          >
            <option value="score">sort · score</option>
            <option value="demand">sort · demand</option>
            <option value="growth">sort · growth</option>
            <option value="alpha">sort · a–z</option>
          </select>
        </div>
      </section>

      {/* Signal graph */}
      {showGraph && (
        <section className="border-b border-line">
          <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-8 md:py-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono-label mb-2">signal graph</p>
                <h2 className="text-xl font-bold tracking-[-0.03em] text-bone md:text-2xl">
                  {category === 'all' ? 'the whole map' : `the ${category} map`}
                </h2>
              </div>
              <p className="max-w-[44ch] text-sm leading-relaxed text-mist">
                {category === 'all'
                  ? 'Sources → categories → niches. Hover or tap to trace a path, tap a niche to drill in.'
                  : `Scoped to ${category}. Hover or tap to trace a path, tap a niche to drill in.`}
              </p>
            </div>
            <NodeFlowView
              niches={niches}
              products={productsRes?.data ?? []}
              health={sourcesRes?.data ?? []}
              category={category === 'all' ? undefined : category}
            />
          </div>
        </section>
      )}

      {/* Grid */}
      <section className="mx-auto max-w-[1600px] px-5 py-10 md:px-8 md:py-14">
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-lg border border-line bg-panel/50"
              />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="py-20 text-center font-mono text-[12px] text-fog">
            no niches in “{category}”
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n, i) => (
            <Reveal key={n.slug} delay={(i % 6) * 0.05}>
              <Link
                to={`/niches/${n.slug}`}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-line bg-panel/40 p-5 transition-all duration-500 hover:-translate-y-1 hover:border-lime/40 md:p-6"
                data-cursor="hover"
              >
                {/* Score glow */}
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(circle, ${
                      n.score >= 70
                        ? 'rgba(215,255,62,0.22)'
                        : n.score >= 50
                          ? 'rgba(232,212,77,0.18)'
                          : 'rgba(255,77,46,0.16)'
                    }, transparent 70%)`,
                  }}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
                      {n.category}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 font-mono text-[10px] tabular tracking-[0.1em] ${
                        n.score >= 70
                          ? 'border-lime/40 text-lime'
                          : n.score >= 50
                            ? 'border-line-bright text-mist'
                            : 'border-signal/40 text-signal'
                      }`}
                    >
                      {n.score}
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-extrabold tracking-[-0.03em] text-bone transition-colors group-hover:text-lime md:text-2xl">
                    {n.name}
                  </h2>

                  {n.description && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-mist">
                      {n.description}
                    </p>
                  )}
                </div>

                <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  <Stat label="demand" value={n.demandIndex} />
                  <Stat label="growth" value={n.wowGrowth} suffix="%" signed />
                  <Stat label="products" value={n.productCount ?? 0} />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix = '',
  signed = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  signed?: boolean;
}) {
  return (
    <div>
      <p className="mono-label !text-[9px] mb-0.5">{label}</p>
      <p className="text-sm font-bold tabular text-bone">
        <Counter
          value={value}
          decimals={Number.isInteger(value) ? 0 : 1}
          suffix={suffix}
        />
        {signed && value >= 0 ? '' : ''}
      </p>
    </div>
  );
}
