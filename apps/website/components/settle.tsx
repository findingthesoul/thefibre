'use client';

// Shapes drift in and settle — like paper placed by hand (brief §6.2). One
// decisive ease-out, no overshoot. The server renders children SETTLED;
// the "from" state applies only client-side, only when IntersectionObserver
// exists, motion is allowed, AND the element starts off-screen — so no-JS,
// reduced-motion and above-the-fold content are never hidden. Zero CLS by
// construction (opacity/transform only).

import { useEffect, useRef, useState } from 'react';

export function Settle({
  children,
  from = { y: 28, rotate: -4 },
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  from?: { y?: number; rotate?: number };
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<'settled' | 'unsettled'>('settled');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) return; // already visible — never hide it

    setState('unsettled');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.setTimeout(() => setState('settled'), delay);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`settle ${className ?? ''}`}
      data-unsettled={state === 'unsettled'}
      style={
        {
          '--settle-y': `${from.y ?? 28}px`,
          '--settle-r': `${from.rotate ?? -4}deg`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
