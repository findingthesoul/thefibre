// The my.thread wordmark, for the top of a page.
//
// Sjoerd, 2026-09-23: "in the my.thread should there not be a logo at the
// top?" — there was not. The signed-out screen set the name as plain text and
// the signed-in chrome showed no mark at all.
//
// One component, three placements (rail, mobile bar, sign-in), so the size and
// the alt text cannot drift apart. `<img>` rather than next/image on purpose:
// it is a fixed-height asset served from this app's own origin, and the
// offline page — a static file with no bundle — has to be able to use the same
// file without a loader.
//
// ── Why there is no dark variant ───────────────────────────────────────────
//
// The artwork is one solid blue on transparent, which needs a light ground.
// This app never switches the `dark` class on: the shared preset is
// `darkMode: 'class'` and nothing in apps/my sets it, so every surface here is
// the light palette. If that ever changes, this needs a light-on-dark file —
// a CSS filter on hand-drawn lettering looks like a mistake.

export function Wordmark({ className = 'h-7' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wordmark.png"
      alt="my.thread"
      width={600}
      height={159}
      className={`${className} w-auto`}
    />
  );
}
