import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Seconds for one full loop. */
  duration?: number;
  className?: string;
  reverse?: boolean;
  /** Pause on hover (good for interactive strips). */
  pauseOnHover?: boolean;
}

/** Infinite horizontal marquee. Content is duplicated for a seamless loop. */
export function Marquee({
  children,
  duration = 34,
  className = '',
  reverse = false,
  pauseOnHover = false,
}: Props) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={
        {
          '--marquee-duration': `${duration}s`,
        } as React.CSSProperties
      }
      data-cursor="hover"
    >
      <div
        className={`marquee-track ${pauseOnHover ? 'hover:[animation-play-state:paused]' : ''}`}
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        <div className="flex shrink-0 items-center" aria-hidden="false">
          {children}
        </div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
