import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface Props {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  /** Re-animate whenever the value changes (for live updates). */
  live?: boolean;
}

/** Odometer-style number that eases to its target. */
export function Counter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.4,
  className = '',
  live = false,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const prev = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prev.current = value;
      return;
    }

    const obj = { n: prev.current };
    const tween = gsap.to(obj, {
      n: value,
      duration,
      ease: 'power3.out',
      onUpdate: () => setDisplay(obj.n),
      onComplete: () => {
        prev.current = value;
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, duration, reduced, live]);

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
