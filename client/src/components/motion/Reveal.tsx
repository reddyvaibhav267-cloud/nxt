import { useRef, useEffect, type ReactNode, type ElementType } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  children: ReactNode;
  className?: string;
  /** Seconds after entering the viewport before the animation starts. */
  delay?: number;
  y?: number;
  as?: ElementType;
  once?: boolean;
}

/** Generic scroll-in reveal: fade + rise with a soft expo ease. */
export function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  as: Tag = 'div',
  once = true,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    gsap.set(el, { autoAlpha: 0, y });

    const ctx = gsap.context(() => {
      const tween = gsap.to(el, {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        delay,
        paused: true,
      });

      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              tween.play();
              if (once) io.disconnect();
            } else if (!once) {
              tween.reverse();
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
      );
      io.observe(el);
      return () => io.disconnect();
    }, ref);

    return () => ctx.revert();
  }, [delay, y, once, reduced]);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={className}>
      {children}
    </Tag>
  );
}
