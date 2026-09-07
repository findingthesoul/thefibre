'use client';

// One rAF-coalesced scroll-progress subscription, shared by the drawn
// thread (and any future parallax). Progress maps an element's journey
// through the viewport to 0..1 between `begin` and `end` (fractions of
// viewport height where the element's top starts/finishes the movement).

import { useEffect, useRef } from 'react';

export function useScrollProgress(
  ref: React.RefObject<Element | null>,
  onProgress: (p: number) => void,
  { begin = 0.9, end = 0.3 }: { begin?: number; end?: number } = {},
): void {
  const cb = useRef(onProgress);
  cb.current = onProgress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cb.current(1);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the section top sits at begin·vh, 1 when it reaches end·vh.
      const raw = (begin * vh - rect.top) / ((begin - end) * vh);
      cb.current(Math.min(1, Math.max(0, raw)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, begin, end]);
}
