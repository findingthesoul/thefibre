'use client';

// A constellation of cut-outs drifting in the whitespace between scenes —
// counder.com's scattered photographs, spoken in Matisse. Each shape sits
// at a fixed position with its own slow parallax factor; everything is
// decorative (aria-hidden), absolute, pointer-events-none, and simply
// static under reduced motion or without JS.

import { useEffect, useRef } from 'react';
import { Shape, type ShapeName } from './shapes';

export type Star = {
  shape: ShapeName;
  /** percentages of the section box */
  x: number;
  y: number;
  /** tailwind width class, e.g. 'w-10' | 'w-16' | 'w-24' */
  w: string;
  /** token colour class */
  color: string;
  rotate?: number;
  /** parallax factor: fraction of scroll delta applied (± small) */
  drift?: number;
  /** hide below md — mobile keeps only the calmest few */
  desktopOnly?: boolean;
};

export function Constellation({ stars, className = '' }: { stars: Star[]; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      const centre = rect.top + rect.height / 2 - window.innerHeight / 2;
      items.current.forEach((el, i) => {
        const drift = stars[i]?.drift ?? 0;
        if (el && drift) el.style.transform = `translateY(${(-centre * drift).toFixed(1)}px)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [stars]);

  return (
    <div ref={ref} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      {stars.map((s, i) => (
        <div
          key={i}
          ref={(el) => {
            items.current[i] = el;
          }}
          className={`absolute will-change-transform ${s.desktopOnly ? 'hidden md:block' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
        >
          <Shape name={s.shape} className={`${s.w} ${s.color}`} rotate={s.rotate ?? 0} />
        </div>
      ))}
    </div>
  );
}
