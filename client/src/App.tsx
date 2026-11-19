import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PageShell } from './components/layout/PageShell';
import { IntroLoader } from './components/motion/IntroLoader';
import { useIntroVisibility } from './hooks/useIntroSeen';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Niches = lazy(() => import('./pages/Niches'));
const NicheDetail = lazy(() => import('./pages/NicheDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function Loading() {
  return (
    <div className="flex min-h-[70svh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fog">
          loading
        </span>
        <div className="h-px w-40 overflow-hidden bg-line">
          <div
            className="h-full w-1/3 bg-lime"
            style={{ animation: 'loadbar 1.1s ease-in-out infinite' }}
          />
        </div>
      </div>
      <style>{`@keyframes loadbar { 0% { transform: translateX(-100%);} 100% { transform: translateX(300%);} }`}</style>
    </div>
  );
}

export default function App() {
  const { show, dismiss } = useIntroVisibility();

  return (
    <>
      {show && <IntroLoader onDone={dismiss} />}
      <PageShell>
        <ScrollToTop />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/niches" element={<Niches />} />
            <Route path="/niches/:slug" element={<NicheDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageShell>
    </>
  );
}
