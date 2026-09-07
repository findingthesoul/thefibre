'use client';

// Sjoerd's paper-cut composition (2026-09-07): his real cut-outs, arranged
// per his reference collage, assembling themselves as the card scrolls in —
// each piece drifts from its own direction and settles into place. Server
// renders the collage ASSEMBLED; the scattered "from" state applies only
// client-side with motion allowed, so no-JS and reduced-motion readers see
// the finished picture. Positions are % of a 17:10 canvas, eyeballed from
// the reference image.

import { useEffect, useRef, useState } from 'react';

type Piece = {
  src: string;
  x: number; // left %
  y: number; // top %
  w: number; // width %
  dx: number; // scattered offset, % of own width-ish (px-scaled)
  dy: number;
  r: number; // scattered rotation, deg
  d: number; // stagger delay, ms
};

const PIECES: Piece[] = [
  { src: 'start-figure.png', x: 7, y: 26, w: 15, dx: -90, dy: -50, r: -22, d: 0 },
  { src: 'yellow-shape.png', x: 20, y: 36, w: 6.2, dx: -40, dy: -110, r: 18, d: 80 },
  { src: 'bordeaux-shape.png', x: 24.5, y: 44, w: 6.5, dx: -70, dy: 60, r: -30, d: 160 },
  { src: 'blue-shape-cup.png', x: 29.5, y: 47, w: 15.3, dx: -30, dy: 130, r: 10, d: 240 },
  { src: 'orange-vase.png', x: 43.2, y: 40, w: 13.2, dx: 0, dy: 160, r: -8, d: 320 },
  { src: 'yellow-egg.png', x: 51.5, y: 38.5, w: 6.3, dx: 50, dy: -120, r: 35, d: 400 },
  { src: 'rise-bowl.png', x: 54.5, y: 61.5, w: 11, dx: 40, dy: 120, r: -14, d: 480 },
  { src: 'blue-bowl.png', x: 64.5, y: 53.5, w: 8.2, dx: 80, dy: 70, r: 20, d: 560 },
  { src: 'blue-square.png', x: 70.5, y: 52, w: 13.2, dx: 110, dy: 30, r: 8, d: 640 },
  { src: 'double-vase.png', x: 80.5, y: 28.5, w: 7.6, dx: 90, dy: -80, r: -16, d: 720 },
  { src: 'turqois-stool.png', x: 77.5, y: 62.5, w: 10, dx: 100, dy: 100, r: 12, d: 800 },
  { src: 'ligth-turqiose-leaf.png', x: 88, y: 13, w: 8.6, dx: 70, dy: -100, r: 28, d: 880 },
];

export function FabricCollage() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [assembled, setAssembled] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setAssembled(false);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setAssembled(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative mx-auto w-full select-none"
      style={{ width: 'min(100%, 86svh, 72rem)' }}
    >
      <div className="relative aspect-[17/10] w-full">
        {PIECES.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.src}
            src={`/shapes/${p.src}`}
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.w}%`,
              transition:
                'transform 1100ms cubic-bezier(0.22, 1, 0.36, 1), opacity 900ms cubic-bezier(0.22, 1, 0.36, 1)',
              transitionDelay: `${p.d}ms`,
              opacity: assembled ? 1 : 0,
              transform: assembled
                ? 'translate(0, 0) rotate(0deg)'
                : `translate(${p.dx}px, ${p.dy}px) rotate(${p.r}deg)`,
            }}
          />
        ))}
        <p
          className="absolute font-serif italic text-accent"
          style={{
            left: '13.5%',
            top: '62%',
            fontSize: 'clamp(6px, 0.8vw, 10px)',
            transform: 'rotate(-32deg)',
            transformOrigin: 'left center',
            transition: 'opacity 900ms ease',
            transitionDelay: '1000ms',
            opacity: assembled ? 1 : 0,
          }}
        >
          Inspired by Matisse&apos;s paper cuts
        </p>
      </div>
    </div>
  );
}
