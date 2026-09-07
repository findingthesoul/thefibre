// One thread, fully laid (Sjoerd, 2026-09-07: "no white interruptions") —
// the line no longer draws itself on scroll; it is simply there, end to
// end, like a thread that has already fallen on the paper. Architecture is
// unchanged: per-section SEGMENTS with an x-fraction handoff convention
// (each segment exits the bottom at the x the next enters at), not one
// literal page-spanning path — responsive reflow would break a single
// path; the segment illusion reads identically. Absolutely positioned,
// aria-hidden, pointer-events-none: it can never shift layout.
//
// begin/end remain in the signature (call sites pass them) but are unused
// since the scroll-scrub was removed; bring back lib/scroll's
// useScrollProgress if a drawn-on-scroll variant is ever wanted again.

export function DrawnThread({
  d,
  viewBox,
  className = 'pointer-events-none absolute inset-0 h-full w-full text-ink',
  strokeWidth = 2.5,
}: {
  d: string;
  viewBox: string;
  className?: string;
  begin?: number;
  end?: number;
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
