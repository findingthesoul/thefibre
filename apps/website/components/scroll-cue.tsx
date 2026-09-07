'use client';

// The turquoise SCROLL cue, next to the thread (Sjoerd: "the arrow needs
// to be next to the line on every card"). Each thread segment exits its
// card's bottom at a known x-fraction — pass that as `x` and the cue sits
// just right of the line. Clicking scrolls one viewport; the snap magnet
// lands it on the next card.

// A deliberate glide (Sjoerd: "an easy scroll, not a jump"). Mandatory
// snap interrupts smooth scrollBy mid-flight, so we animate the scroll
// ourselves with the snap released, and hand back to the magnet at the
// end of the ride.
function glideOneViewport() {
  const root = document.documentElement;
  const from = window.scrollY;
  // Aim at the next card's actual top (the sticky nav shifts every card
  // down, so a blind viewport-length hop always lands short).
  const tops = Array.from(document.querySelectorAll<HTMLElement>('.snap-start'))
    .map((el) => el.getBoundingClientRect().top + window.scrollY)
    .sort((a, b) => a - b);
  const to = tops.find((y) => y > from + 10) ?? from + window.innerHeight;
  const prevSnap = root.style.scrollSnapType;
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollSnapType = 'none';
  root.style.scrollBehavior = 'auto'; // html's smooth would ease every frame
  const t0 = performance.now();
  const D = 700;
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / D);
    window.scrollTo(0, from + (to - from) * ease(p));
    if (p < 1) requestAnimationFrame(step);
    else {
      root.style.scrollSnapType = prevSnap;
      root.style.scrollBehavior = prevBehavior;
    }
  };
  requestAnimationFrame(step);
}

export function ScrollCue({ x, color = '#2fb3ab' }: { x: number; color?: string }) {
  return (
    <button
      type="button"
      aria-label="Next card"
      onClick={glideOneViewport}
      className="absolute bottom-10 z-10 flex items-center gap-3 transition-opacity hover:opacity-60"
      style={{ left: `calc(${x}% + 16px)` }}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color }}>
        Scroll
      </span>
      <svg
        width="11"
        height="14"
        viewBox="0 0 14 18"
        aria-hidden="true"
        className="animate-bounce"
        style={{ color }}
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
