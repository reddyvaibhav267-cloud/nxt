import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

const NAV = [
  { to: '/', label: 'index', code: '01' },
  { to: '/dashboard', label: 'dashboard', code: '02' },
  { to: '/niches', label: 'niches', code: '03' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: ({ signal }) => api.sources(signal),
    refetchInterval: 60_000,
  });

  const health = sources?.data ?? [];
  const liveCount = health.filter((h) => h.status === 'live').length;
  const isLive = liveCount > 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? 'border-b border-line bg-void/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5 md:h-[72px] md:px-8">
        {/* Wordmark */}
        <Link to="/" className="group flex items-baseline gap-2" aria-label="nxt home">
          <span className="text-[26px] font-extrabold tracking-[-0.06em] text-bone transition-colors group-hover:text-lime md:text-[30px]">
            nxt
          </span>
          <span className="hidden translate-y-[-1px] font-mono text-[11px] uppercase tracking-[0.16em] text-fog sm:inline">
            v-001
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-baseline gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                  isActive ? 'text-lime' : 'text-fog hover:text-bone'
                }`
              }
            >
              <span className="text-[9px] opacity-50">{item.code}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Live status pill */}
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex ${
              isLive
                ? 'border-lime/35 pill-live text-lime'
                : 'border-signal/35 pill-degraded text-signal'
            }`}
            title={
              isLive
                ? `${liveCount}/${health.length} sources streaming live`
                : 'Serving fallback/sample data'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-lime' : 'bg-signal'}`}
              style={{
                animation: isLive ? 'pulse 1.8s ease-in-out infinite' : 'none',
              }}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
              {isLive ? 'live' : 'sampled'}
            </span>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute left-0 top-0 h-px w-full bg-bone transition-transform duration-300 ${
                  open ? 'translate-y-[5.5px] rotate-45' : ''
                }`}
              />
              <span
                className={`absolute left-0 top-[5.5px] h-px w-full bg-bone transition-transform duration-300 ${
                  open ? '-translate-y-[5.5px] -rotate-45' : ''
                }`}
              />
            </span>
          </button>

          <Link
            to="/dashboard"
            className="group hidden items-center gap-2 rounded-full bg-lime px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-void transition-all hover:bg-bone md:inline-flex"
          >
            open app
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        className={`overflow-hidden border-t border-line bg-void/95 backdrop-blur-xl transition-[max-height] duration-500 md:hidden ${
          open ? 'max-h-72' : 'max-h-0 border-t-0'
        }`}
      >
        <nav className="flex flex-col px-5 py-3" aria-label="Mobile">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-baseline gap-3 border-b border-line py-3.5 font-mono text-xs uppercase tracking-[0.16em] ${
                  isActive ? 'text-lime' : 'text-mist'
                }`
              }
            >
              <span className="text-[10px] opacity-50">{item.code}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="py-3">
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
                isLive ? 'text-lime' : 'text-signal'
              }`}
            >
              ● {isLive ? `${liveCount} sources live` : 'sampled data'}
            </span>
          </div>
        </nav>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: .45; transform: scale(.8);} }`}</style>
    </header>
  );
}
