'use client';

// Scroll-scrubbed paper-cut collage, v3 (Sjoerd, 2026-09-08: "make the
// coming together more natural"). The scroll position only sets each
// piece's TARGET; the piece chases it with its own exponential lag —
// a true ease-in/ease-out with no fixed duration. Consequences he asked
// for, by construction: parts are still settling after the card has
// arrived (slow chasers), and scrolling on before it completes simply
// reverses the chase mid-flight — the picture falls apart from wherever
// it got to, never snapping to done first.
//
// Server renders ASSEMBLED; motion is client-only and imperative (styles
// written in one rAF loop, no per-frame React renders). Reduced-motion
// readers keep the finished picture.

import { useEffect, useRef } from 'react';

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

const smoothstep = (v: number) => v * v * (3 - 2 * v);

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
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const captionRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const anchor = el.closest('section') ?? el;

    const target = () => {
      const r = anchor.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const d = Math.abs(r.top + r.height / 2 - vh / 2) / vh;
      return smoothstep(1 - Math.min(1, d));
    };

    // Each piece's chase speed (1/s): varied so some pieces are still
    // drifting into place after the fast ones have settled.
    const speeds = pieces.map((_, i) => 1.7 + ((i * 7) % 5) * 0.55);
    const t0 = target();
    const cur = pieces.map((p) => Math.pow(t0, p.e ?? 1));
    let curCap = t0;

    const apply = () => {
      pieces.forEach((p, i) => {
        const img = imgRefs.current[i];
        if (!img) return;
        const c = cur[i]!;
        const u = 1 - c;
        img.style.opacity = `${Math.min(1, Math.pow(c, 0.6) * 1.2)}`;
        img.style.transform = `translate(${p.dx * u}vw, ${p.dy * u}vh) rotate(${p.r * u}deg)`;
      });
      if (captionRef.current) captionRef.current.style.opacity = `${curCap}`;
    };
    apply();

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const tgt = target();
      pieces.forEach((p, i) => {
        const goal = Math.pow(tgt, p.e ?? 1);
        cur[i]! += (goal - cur[i]!) * (1 - Math.exp(-dt * speeds[i]!));
      });
      curCap += (tgt - curCap) * (1 - Math.exp(-dt * 2));
      apply();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces]);

  return (
    <div ref={ref} aria-hidden="true" className={`relative select-none ${className}`} style={style}>
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        {pieces.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.src}
            ref={(n) => {
              imgRefs.current[i] = n;
            }}
            src={`/shapes/${p.src}`}
            alt=""
            draggable={false}
            className="absolute will-change-transform"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%` }}
          />
        ))}
        {caption && (
          <p
            ref={captionRef}
            className="absolute font-serif italic text-accent"
            style={{
              left: `${caption.x}%`,
              top: `${caption.y}%`,
              fontSize: 'clamp(6px, 0.8vw, 10px)',
              transform: `rotate(${caption.rotate}deg)`,
              transformOrigin: 'left center',
            }}
          >
            {caption.text}
          </p>
        )}
      </div>
    </div>
  );
}
