import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TypeScene } from '../components/three/TypeScene';
import { SplitText } from '../components/motion/SplitText';
import { Reveal } from '../components/motion/Reveal';
import { Counter } from '../components/motion/Counter';
import { Marquee } from '../components/motion/Marquee';
import { api } from '../api/client';

const FEATURES = [
  {
    code: '01',
    title: 'Live demand signals',
    body: 'Google search interest, Amazon rank movement and TikTok creative trends — pulled on a schedule, not a dashboard you have to babysit.',
    meta: 'google · amazon · tiktok',
  },
  {
    code: '02',
    title: 'Opportunity scoring',
    body: 'Every niche gets a 0–100 score blending demand, growth velocity, market headroom and margin band. Ranking you can argue with.',
    meta: 'weighted · transparent',
  },
  {
    code: '03',
    title: 'Refresh, not stale',
    body: 'A background scheduler re-crawls each source on its own cadence and pushes updates over SSE — rows animate in while you watch.',
    meta: 'cron · sse · fallback',
  },
];

const CATEGORIES = [
  'Home & Kitchen',
  'Health & Beauty',
  'Pet Tech',
  'Electronics',
  'Sports & Outdoors',
  'Toys & Games',
];

export default function Home() {
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => api.stats(signal),
    refetchInterval: 45_000,
  });

  const { data: nichesRes } = useQuery({
    queryKey: ['niches'],
    queryFn: ({ signal }) => api.niches(signal),
    refetchInterval: 120_000,
  });

  const stats = statsRes?.data;

  // The intro loader delays the hero choreography; when it has already been
  // seen this session, reveal immediately instead of waiting behind nothing.
  const introSeen = (() => {
    try {
      return sessionStorage.getItem('nxt:seen-intro') === '1';
    } catch {
      return false;
    }
  })();
  const heroDelay = introSeen ? 0.35 : 2.45;
  const statsDelay = introSeen ? 0.15 : 0.45;

  // Every category the catalogue actually tracks — keeps the strip honest
  // as niches are added.
  const marqueeCategories = (() => {
    const set = new Set((nichesRes?.data ?? []).map((n) => n.category));
    const list = Array.from(set).sort();
    return list.length > 0 ? list : CATEGORIES;
  })();

  return (
    <div className="relative">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative flex min-h-svh flex-col overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-[0.35]" />
        <div className="vignette pointer-events-none absolute inset-0" />

        {/* Full-bleed 3D logotype — with the HTML headline gone there is
            nothing for it to collide with. */}
        <TypeScene className="absolute inset-0" />

        {/* Scrims: light top wash for the meta label, solid bottom for stats. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,9,10,0.6) 0%, rgba(8,9,10,0) 22%, rgba(8,9,10,0) 58%, rgba(8,9,10,0.85) 86%, rgba(8,9,10,1) 100%)',
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-between px-5 pb-8 pt-28 md:px-8 md:pb-10 md:pt-36">
          {/* Top meta row */}
          <div className="flex justify-end">
            <SplitText mode="lines" delay={heroDelay} className="text-right">
              <span className="mono-label float-soft [animation-delay:-3s] !text-mist">
                est. 2026 — v001
              </span>
            </SplitText>
          </div>

          {/* Bottom live stats */}
          <Reveal delay={statsDelay}>
            <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
              <StatCell
                label="niches tracked"
                value={stats?.nichesTracked ?? 0}
                loading={statsLoading}
                suffix=""
              />
              <StatCell
                label="products ranked"
                value={stats?.productsTracked ?? 0}
                loading={statsLoading}
              />
              <StatCell
                label="data points"
                value={stats?.dataPoints ?? 0}
                loading={statsLoading}
              />
              <StatCell
                label="avg opportunity"
                value={stats?.avgOpportunity ?? 0}
                loading={statsLoading}
                decimals={1}
                accent
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- marquee */}
      <section className="border-b border-line bg-ink py-5">
        <Marquee duration={40} pauseOnHover>
          {marqueeCategories.map((c) => (
            <span
              key={c}
              className="mx-6 flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-fog md:mx-9"
            >
              {c}
              <span className="text-lime">◆</span>
            </span>
          ))}
        </Marquee>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="mx-auto max-w-[1600px] px-5 py-20 md:px-8 md:py-32">
        <Reveal className="mb-14 flex flex-wrap items-end justify-between gap-6 md:mb-20">
          <h2 className="display-lg max-w-[14ch] text-bone">
            how the
            <br />
            <span className="text-lime">signal</span> works
          </h2>
          <p className="mono-label max-w-[30ch] !text-fog">
            three layers — collection, scoring, delivery
          </p>
        </Reveal>

        <div className="border-t border-line">
          {FEATURES.map((f, i) => (
            <Reveal key={f.code} delay={i * 0.08}>
              <article className="group grid gap-4 border-b border-line py-9 transition-colors hover:bg-panel/40 md:grid-cols-[90px_1.1fr_1.4fr] md:gap-10 md:py-12">
                <span className="font-mono text-[11px] tracking-[0.16em] text-lime">
                  {f.code}
                </span>
                <h3 className="display-md text-bone transition-transform duration-500 group-hover:translate-x-1">
                  {f.title}
                </h3>
                <div>
                  <p className="max-w-[52ch] text-sm leading-relaxed text-mist md:text-[15px]">
                    {f.body}
                  </p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-fog">
                    {f.meta}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ cta */}
      <section className="relative overflow-hidden border-t border-line bg-ink">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 70% 50%, rgba(215,255,62,0.09), transparent 65%)',
          }}
        />
        <div className="relative mx-auto flex max-w-[1600px] flex-col items-start gap-8 px-5 py-24 md:px-8 md:py-36">
          <Reveal>
            <p className="mono-label float-soft mb-5">ready when you are</p>
            <h2 className="display-lg max-w-[16ch] text-bone">
              stop guessing
              <br />
              which niche
              <span className="text-lime">.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-4 rounded-full border border-lime/40 bg-lime/10 px-7 py-4 font-mono text-[11px] uppercase tracking-[0.16em] text-lime transition-all hover:bg-lime hover:text-void"
              data-cursor="hover"
            >
              open the dashboard
              <span className="inline-block nudge-x transition-transform group-hover:[animation:none] group-hover:translate-x-1.5">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function StatCell({
  label,
  value,
  loading,
  decimals = 0,
  accent = false,
  suffix = '',
}: {
  label: string;
  value: number;
  loading: boolean;
  decimals?: number;
  accent?: boolean;
  suffix?: string;
}) {
  return (
    <div className="bg-void px-4 py-5 md:px-6 md:py-7">
      <p className="mono-label mb-2 !text-[10px]">{label}</p>
      <p
        className={`text-3xl font-extrabold tracking-[-0.04em] md:text-[42px] ${
          accent ? 'text-lime' : 'text-bone'
        }`}
      >
        {loading ? (
          <span className="inline-block h-[1em] w-16 animate-pulse rounded bg-line" />
        ) : (
          <Counter value={value} decimals={decimals} suffix={suffix} />
        )}
      </p>
    </div>
  );
}
