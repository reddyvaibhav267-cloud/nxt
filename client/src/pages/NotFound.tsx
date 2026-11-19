import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-[80svh] flex-col items-center justify-center gap-6 px-5 pt-16 text-center">
      <p className="mono-label">404 / dead end</p>
      <p className="display-xl text-bone">
        4<span className="text-lime">0</span>4
      </p>
      <p className="max-w-[38ch] text-sm leading-relaxed text-mist">
        That route isn't in the index. The signal dropped somewhere between
        here and the dashboard.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-full bg-lime px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-void transition-colors hover:bg-bone"
        >
          back home
        </Link>
        <Link
          to="/dashboard"
          className="rounded-full border border-line-bright px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-mist transition-colors hover:border-lime/50 hover:text-bone"
        >
          dashboard
        </Link>
      </div>
    </div>
  );
}
