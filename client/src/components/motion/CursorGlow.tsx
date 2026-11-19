import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Custom cursor: a small lime dot with a trailing glow ring.
 * Disabled on touch devices and when reduced motion is preferred.
 */
export function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { x: pos.x, y: pos.y };
    let hovering = false;

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, autoAlpha: 0 });

    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      gsap.to(dot, { x: pos.x, y: pos.y, autoAlpha: 1, duration: 0.12, ease: 'power2.out' });

      const target = e.target as HTMLElement | null;
      hovering = Boolean(
        target?.closest('a, button, [role="button"], input, [data-cursor="hover"]'),
      );
      gsap.to(ring, {
        scale: hovering ? 2.1 : 1,
        borderColor: hovering ? 'rgba(215,255,62,0.85)' : 'rgba(215,255,62,0.32)',
        duration: 0.35,
        ease: 'power3.out',
      });
    };

    const tick = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      gsap.set(ring, { x: ringPos.x, y: ringPos.y });
    };

    const gsapTick = gsap.ticker.add(tick);
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      gsap.ticker.remove(gsapTick);
      void gsapTick;
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] hidden md:block"
      aria-hidden="true"
    >
      <div
        ref={ringRef}
        className="fixed left-0 top-0 h-8 w-8 rounded-full border"
        style={{ borderColor: 'rgba(215,255,62,0.32)' }}
      />
      <div
        ref={dotRef}
        className="fixed left-0 top-0 h-1.5 w-1.5 rounded-full bg-lime"
        style={{ boxShadow: '0 0 12px 2px rgba(215,255,62,0.55)' }}
      />
    </div>
  );
}
