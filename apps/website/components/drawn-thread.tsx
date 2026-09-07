'use client';

// The signature move (brief §6.1): a single line — the thread — drawing
// itself as you scroll. Architecture: per-section SEGMENTS with an
// x-fraction handoff convention (each segment exits the bottom at the x
// the next enters at), not one literal page-spanning path — responsive
// reflow would break a single path; the segment illusion reads identically.
//
// Degradation is the contract: the SVG is server-rendered FULLY DRAWN (no
// dasharray in markup). Only after hydration — and only when motion is
// allowed — does the component measure the path and scrub stroke-dashoffset
// from scroll progress. No JS, reduced motion, old browsers: the line is
// simply there. Absolutely positioned, aria-hidden, pointer-events-none:
// it can never shift layout.

import { useEffect, useRef } from 'react';
import { useScrollProgress } from '@/lib/scroll';

// The handoff x-fractions between Home sections (0..1 of section width).
export const THREAD_X = { heroOut: 0.72, turnOut: 0.3, arcOut: 0.62, workshopOut: 0.4 };

export function DrawnThread({
  d,
  viewBox,
  className = 'pointer-events-none absolute inset-0 h-full w-full text-ink',
  begin = 0.85,
  end = 0.25,
  strokeWidth = 2.5,
}: {
  d: string;
  viewBox: string;
  className?: string;
  begin?: number;
  end?: number;
  strokeWidth?: number;
}) {
  const wrapRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const lenRef = useRef<number | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const len = path.getTotalLength();
    lenRef.current = len;
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
  }, []);

  useScrollProgress(
    wrapRef,
    (p) => {
      const path = pathRef.current;
      const len = lenRef.current;
      if (!path || len === null) return;
      path.style.strokeDashoffset = `${len * (1 - p)}`;
    },
    { begin, end },
  );

  return (
    <svg
      ref={wrapRef}
      viewBox={viewBox}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
