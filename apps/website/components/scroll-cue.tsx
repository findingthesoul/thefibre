'use client';

// The turquoise SCROLL cue, next to the thread (Sjoerd: "the arrow needs
// to be next to the line on every card"). Each thread segment exits its
// card's bottom at a known x-fraction — pass that as `x` and the cue sits
// just right of the line. Clicking scrolls one viewport; the snap magnet
// lands it on the next card.

export function ScrollCue({ x }: { x: number }) {
  return (
    <button
      type="button"
      aria-label="Next card"
      onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
      className="absolute bottom-10 z-10 flex items-center gap-3 transition-opacity hover:opacity-60"
      style={{ left: `calc(${x}% + 16px)` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#2fb3ab]">
        Scroll
      </span>
      <svg
        width="11"
        height="14"
        viewBox="0 0 14 18"
        aria-hidden="true"
        className="animate-bounce text-[#2fb3ab]"
      >
        <path
          d="M7 1 V15 M2 10.5 L7 16 L12 10.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
