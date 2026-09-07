'use client';

// Scroll-scrubbed paper-cut collage (Sjoerd's direction, 2026-09-07 v2):
// the pieces COMPILE as the card scrolls toward the viewport centre and
// FALL APART as it leaves — tied to scroll position, not a one-shot
// trigger. Each piece has its own entry vector (in vw/vh units, so
// "from the left edge" means the actual screen edge) and its own pace,
// which is how a shape "travels" between cards: give it an exit toward
// the bottom here and an entry from the top on the next card, and the
// eye reads one shape moving down the page.
//
// Server renders ASSEMBLED (t=1); scrubbing is client-only, and
// reduced-motion readers keep the finished picture.

import { useEffect, useRef, useState } from 'react';

export type ScrubPiece = {
  src: string;
  x: number; // final left, % of canvas
  y: number; // final top, % of canvas
  w: number; // width, % of canvas
  dx: number; // scattered offset, vw
  dy: number; // scattered offset, vh
  r: number; // scattered rotation, deg
  e?: number; // pace exponent: <1 arrives early, >1 arrives late
};

export function ScrollCollage({
  pieces,
  aspect,
  caption,
  className = '',
  style,
}: {
  pieces: ScrubPiece[];
  aspect: string; // CSS aspect-ratio for the canvas, e.g. '17 / 10'
  caption?: { text: string; x: number; y: number; rotate: number };
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anchor = el.closest('section') ?? el;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = anchor.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const d = Math.abs(r.top + r.height / 2 - vh / 2) / vh;
      const raw = 1 - Math.min(1, d);
      setT(raw * raw * (3 - 2 * raw)); // smoothstep
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className={`relative select-none ${className}`} style={style}>
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        {pieces.map((p) => {
          const tp = Math.pow(t, p.e ?? 1);
          const u = 1 - tp;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.src}
              src={`/shapes/${p.src}`}
              alt=""
              draggable={false}
              className="absolute will-change-transform"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.w}%`,
                opacity: Math.min(1, Math.pow(tp, 0.6) * 1.2),
                transform: `translate(${p.dx * u}vw, ${p.dy * u}vh) rotate(${p.r * u}deg)`,
              }}
            />
          );
        })}
        {caption && (
          <p
            className="absolute font-serif italic text-accent"
            style={{
              left: `${caption.x}%`,
              top: `${caption.y}%`,
              fontSize: 'clamp(6px, 0.8vw, 10px)',
              transform: `rotate(${caption.rotate}deg)`,
              transformOrigin: 'left center',
              opacity: t,
            }}
          >
            {caption.text}
          </p>
        )}
      </div>
    </div>
  );
}
