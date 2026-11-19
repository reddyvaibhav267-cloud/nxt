import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface Props {
  onDone: () => void;
}

/**
 * Full-screen intro: mono status line, giant percentage counter,
 * "enter" prompt — then a clip-path wipe out.
 * Modeled on rogierdeboeve.com's loader.
 */
export function IntroLoader({ onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = rootRef.current;
    if (!root) return;

    const state = { v: 0 };
    const tl = gsap.timeline({
      onComplete: () => onDone(),
    });

    if (reduced) {
      tl.set(root, { autoAlpha: 0, display: 'none' }).call(() => setReady(true));
      return () => {
        tl.kill();
      };
    }

    tl.to(state, {
      v: 100,
      duration: 2.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        const n = Math.round(state.v);
        if (pctRef.current) pctRef.current.textContent = String(n).padStart(3, '0');
        if (barRef.current) barRef.current.style.transform = `scaleX(${state.v / 100})`;
      },
    })
      .call(() => setReady(true))
      .to(root, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.95,
        ease: 'power4.inOut',
        delay: 0.25,
      })
      .set(root, { display: 'none' });

    return () => {
      tl.kill();
    };
  }, [onDone]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-void px-6 py-6 md:px-10 md:py-8"
      style={{ clipPath: 'inset(0 0 0% 0)' }}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between">
        <span className="mono-label">nxt / v001</span>
        <span className="mono-label">niche trend intelligence</span>
      </div>

      <div className="flex items-end justify-between gap-6">
        <div className="overflow-hidden">
          <div
            className={`display-xl transition-transform duration-1000 ${ready ? 'translate-y-0' : 'translate-y-0'}`}
          >
            <span ref={pctRef} className="tabular text-bone">
              000
            </span>
            <span className="text-lime">%</span>
          </div>
        </div>
        <div className="hidden shrink-0 pb-3 text-right md:block">
          <p className="mono-label mb-2">enter without sound</p>
          <p className="font-mono text-[11px] text-fog">
            live data · google · amazon · tiktok
          </p>
        </div>
      </div>

      <div className="relative h-px w-full bg-line">
        <div
          ref={barRef}
          className="absolute inset-0 origin-left bg-lime"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </div>
  );
}
