import { useRef, useEffect, type ReactNode } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  children: ReactNode;
  /** Seconds of stagger between lines/chars. */
  delay?: number;
  /** 'lines' wraps each child in an overflow mask; 'chars' splits text. */
  mode?: 'lines' | 'chars' | 'words';
  className?: string;
  /** Play when this enters the viewport (default) or immediately. */
  immediate?: boolean;
}

/**
 * Masked text reveal — each unit slides up from an overflow-hidden box.
 * The signature move on rogierdeboeve / basement-style sites.
 */
export function SplitText({
  children,
  delay = 0,
  mode = 'lines',
  className = '',
  immediate = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const targets =
      mode === 'chars'
        ? el.querySelectorAll<HTMLElement>('[data-split="char"]')
        : mode === 'words'
          ? el.querySelectorAll<HTMLElement>('[data-split="word"]')
          : el.querySelectorAll<HTMLElement>('[data-split="line"]');

    if (targets.length === 0) return;

    gsap.set(targets, { yPercent: 110 });

    const ctx = gsap.context(() => {
      const tween = gsap.to(targets, {
        yPercent: 0,
        duration: 1.05,
        ease: 'power4.out',
        stagger: mode === 'lines' ? 0.08 : 0.024,
        delay,
        paused: !immediate,
      });

      if (!immediate) {
        const io = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                tween.play();
                io.disconnect();
              }
            }
          },
          { threshold: 0.25, rootMargin: '0px 0px -8% 0px' },
        );
        io.observe(el);
        return () => io.disconnect();
      }
    }, ref);

    return () => ctx.revert();
  }, [delay, mode, immediate, reduced]);

  /** Split plain strings into units; pass-through for element children. */
  const render = (): ReactNode => {
    if (typeof children === 'string' && (mode === 'chars' || mode === 'words')) {
      const units = mode === 'chars' ? Array.from(children) : children.split(' ');
      return units.map((u, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom">
          <span
            data-split={mode === 'chars' ? 'char' : 'word'}
            className="inline-block will-change-transform"
          >
            {u === ' ' ? '\u00A0' : u}
            {mode === 'words' && i < units.length - 1 ? '\u00A0' : ''}
          </span>
        </span>
      ));
    }
    if (typeof children === 'string') {
      return (
        <span className="block overflow-hidden">
          <span data-split="line" className="block will-change-transform">
            {children}
          </span>
        </span>
      );
    }
    // Element children: wrap each direct child in a line mask.
    const arr = Array.isArray(children) ? children : [children];
    return arr.map((child, i) => (
      <span key={i} className="block overflow-hidden">
        <span data-split="line" className="block will-change-transform">
          {child}
        </span>
      </span>
    ));
  };

  return (
    <div ref={ref} className={className}>
      {render()}
    </div>
  );
}
