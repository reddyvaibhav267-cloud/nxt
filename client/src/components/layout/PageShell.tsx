import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';
import { Header } from './Header';
import { Footer } from './Footer';
import { CursorGlow } from '../motion/CursorGlow';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  children: ReactNode;
  /** Hide the footer (used on the full-bleed dashboard). */
  bare?: boolean;
}

/**
 * App chrome: smooth scroll, grain overlay, cursor, header/footer.
 * Lenis is skipped entirely when reduced motion is preferred.
 */
export function PageShell({ children, bare = false }: Props) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduced]);

  return (
    <div className="relative min-h-svh bg-void text-bone">
      <div className="grain" aria-hidden="true" />
      <CursorGlow />
      <Header />
      <main id="main" className="relative">
        {children}
      </main>
      {!bare && <Footer />}
    </div>
  );
}
