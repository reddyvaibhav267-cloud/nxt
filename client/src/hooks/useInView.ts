import { useEffect, useState, type RefObject } from 'react';

/**
 * True while the element is near the viewport. Starts `true` so the first
 * frame always paints; used to pause WebGL frameloops when scrolled away.
 */
export function useInView<T extends HTMLElement>(ref: RefObject<T | null>): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: '80px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return inView;
}
