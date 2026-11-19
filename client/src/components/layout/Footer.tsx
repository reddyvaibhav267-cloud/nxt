import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { Marquee } from '../motion/Marquee';

export function Footer() {
  const { data: statsRes } = useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => api.stats(signal),
  });

  const sourceStrip = [
    'Google Trends',
    'Amazon Best Sellers',
    'TikTok Creative Center',
    'refreshed continuously',
    `${statsRes?.data?.nichesTracked ?? '—'} niches tracked`,
    'opportunity scoring',
  ];

  return (
    <footer className="relative border-t border-line bg-ink">
      <Marquee duration={38} className="border-b border-line py-4">
        {sourceStrip.map((s) => (
          <span
            key={s}
            className="mx-6 font-mono text-[11px] uppercase tracking-[0.2em] text-fog md:mx-10"
          >
            {s} <span className="ml-6 text-lime">✦</span>
          </span>
        ))}
      </Marquee>

      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8 md:py-20">
        <div>
          <p className="display-md mb-4 text-bone">
            nxt<span className="text-lime">.</span>
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-mist">
            Live niche trend intelligence for dropshipping operators. Demand
            signals from search, marketplace and social — scored, ranked and
            refreshed on a schedule.
          </p>
        </div>

        <div>
          <p className="mono-label mb-4">navigate</p>
          <ul className="space-y-2.5">
            {[
              { to: '/', label: 'Index' },
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/niches', label: 'Niches' },
            ].map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="group flex items-center gap-2 text-sm text-mist transition-colors hover:text-lime"
                >
                  <span className="h-px w-4 bg-line-bright transition-all group-hover:w-7 group-hover:bg-lime" />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mono-label mb-4">data sources</p>
          <ul className="space-y-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-mist">
            <li>Google Trends</li>
            <li>Amazon Best Sellers</li>
            <li>TikTok Creative Center</li>
            <li className="text-fog">fallback: seeded catalogue</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-5 py-5 font-mono text-[10px] uppercase tracking-[0.16em] text-fog md:flex-row md:items-center md:justify-between md:px-8">
          <span>© {new Date().getFullYear()} nxt — trend intelligence</span>
          <span>signals, not guarantees · do your own validation</span>
        </div>
      </div>
    </footer>
  );
}
