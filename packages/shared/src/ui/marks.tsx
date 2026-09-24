// The Thread's drawn marks: one fallen line, and the cut-out library.
//
// These were born in apps/website, which is where the brand's visual
// language was worked out. They moved here on 2026-09-24 because the public
// site themes needed them — Sjoerd asked for the event pages to rhyme with
// the design of the site — and CLAUDE.md is explicit that the second user of
// a thing extracts it rather than forking a per-app variant. The website now
// re-exports from here; there is one copy of each path.
//
// Both are DECORATIVE and say so: aria-hidden, focusable={false}, and no
// layout of their own. Colour rides `currentColor`, so a caller sets it with
// a token class (text-ink, text-ink-muted) and never a hex.

/** One thread, fully laid — it does not draw itself on scroll, it is simply
 *  there, end to end, like a thread that has already fallen on the paper
 *  (Sjoerd, 2026-09-07: "no white interruptions").
 *
 *  Callers pass per-section segments with an x-fraction handoff — each
 *  segment exits the bottom at the x the next one enters at — rather than
 *  one page-spanning path, because responsive reflow breaks a single path
 *  and the segment illusion reads identically.
 *
 *  `preserveAspectRatio="none"` is what lets a segment stretch to whatever
 *  height its section ends up being, and `vectorEffect="non-scaling-stroke"`
 *  is what stops that stretch from making the line fat in one axis. */
export function DrawnThread({
  d,
  viewBox,
  className = 'pointer-events-none absolute inset-0 h-full w-full text-ink',
  strokeWidth = 2.5,
}: {
  d: string;
  viewBox: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
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

// The cut-out library — Matisse's rule kept literally: each shape is ONE
// path, a single unbroken cut. Size via width classes; colour via a token
// class on the element or an ancestor.

export type ShapeName = 'vessel' | 'leaf' | 'figure' | 'burst' | 'wave';

export const SHAPES: Record<ShapeName, { d: string; viewBox: string; aspect: string }> = {
  vessel: {
    viewBox: '0 0 100 140',
    aspect: 'aspect-[100/140]',
    d: 'M50 4 C62 4 70 10 68 20 C66 28 60 32 62 40 C66 58 88 66 90 92 C92 122 74 136 50 136 C26 136 8 122 10 92 C12 66 34 58 38 40 C40 32 34 28 32 20 C30 10 38 4 50 4 Z',
  },
  leaf: {
    viewBox: '0 0 100 160',
    aspect: 'aspect-[100/160]',
    d: 'M50 2 C74 30 92 64 86 100 C80 134 64 152 50 158 C42 132 20 118 16 88 C12 58 30 28 50 2 Z',
  },
  figure: {
    viewBox: '0 0 100 150',
    aspect: 'aspect-[100/150]',
    d: 'M58 6 C70 8 74 20 68 30 C62 40 52 42 54 52 C58 66 84 70 88 90 C92 112 76 118 64 112 C54 107 52 96 44 98 C30 102 34 124 22 136 C12 146 0 140 4 126 C10 108 26 100 28 84 C30 68 18 60 20 44 C22 24 40 2 58 6 Z',
  },
  burst: {
    viewBox: '0 0 120 120',
    aspect: 'aspect-square',
    d: 'M60 2 L70 38 L104 20 L82 52 L118 60 L82 68 L104 100 L70 82 L60 118 L50 82 L16 100 L38 68 L2 60 L38 52 L16 20 L50 38 Z',
  },
  wave: {
    viewBox: '0 0 200 60',
    aspect: 'aspect-[200/60]',
    d: 'M0 42 C20 20 42 18 62 32 C82 46 102 46 122 32 C142 18 162 18 182 30 C190 35 196 34 200 28 L200 60 L0 60 Z',
  },
};

type ShapeProps = {
  name: ShapeName;
  className?: string;
  rotate?: number;
  flip?: boolean;
};

export function Shape({ name, className, rotate = 0, flip = false }: ShapeProps) {
  const s = SHAPES[name];
  return (
    <svg
      viewBox={s.viewBox}
      className={className}
      style={
        rotate || flip
          ? { transform: `${flip ? 'scaleX(-1) ' : ''}rotate(${rotate}deg)` }
          : undefined
      }
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={s.d} />
    </svg>
  );
}

export const Vessel = (p: Omit<ShapeProps, 'name'>) => <Shape name="vessel" {...p} />;
export const Leaf = (p: Omit<ShapeProps, 'name'>) => <Shape name="leaf" {...p} />;
export const Figure = (p: Omit<ShapeProps, 'name'>) => <Shape name="figure" {...p} />;
export const Burst = (p: Omit<ShapeProps, 'name'>) => <Shape name="burst" {...p} />;
export const Wave = (p: Omit<ShapeProps, 'name'>) => <Shape name="wave" {...p} />;
