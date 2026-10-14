// The editor's shape, shown the instant a thread is clicked.
//
// Sjoerd: "sometimes when I click a thread, nothing happens. Or it takes
// long. In the other version we immediately went to the thread page... it
// showed an empty 'grid' in which it loaded the content."
//
// The cause was a missing boundary, not only a slow page: the only
// loading.tsx sat at the (app) level, which wraps the `threads` segment — and
// /threads → /threads/[id] keeps that segment and changes its child, so no
// boundary showed and Next held the list on screen for the whole server time
// (measured 1.7–2.6s on staging, 2026-10-14). A loading file HERE is the
// fallback for exactly that navigation, and Next prefetches it for every
// visible thread link, so it paints on the click.
//
// Same column and rhythm as ThreadTimeline: the header row (back, date,
// title, status, tools), the team line, then the timeline rail with cards.

const block = 'animate-pulse rounded-md bg-surface-sunken';

export default function ThreadLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10" aria-busy="true" aria-live="polite">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className={`${block} h-9 w-9 shrink-0`} />
        <div className={`${block} h-12 w-12 shrink-0 rounded-lg`} />
        <div className={`${block} h-8 min-w-0 flex-1`} />
        <div className={`${block} h-7 w-24 shrink-0 rounded-full`} />
        <div className={`${block} h-9 w-9 shrink-0`} />
        <div className={`${block} h-9 w-9 shrink-0`} />
      </div>
      <div className="mt-2 ml-12">
        <div className={`${block} h-5 w-28 rounded-full`} />
      </div>

      {/* The timeline: a rail on the left, a card per element */}
      <div className="relative mt-8 ml-5 pl-11">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-line" aria-hidden />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative mb-6">
            <div className="absolute -left-[3.05rem] top-3 h-4 w-4 rounded-full bg-surface-sunken ring-4 ring-surface" aria-hidden />
            <div className="rounded-xl border border-line bg-surface-raised p-4">
              <div className={`${block} h-4 w-1/3`} />
              <div className={`${block} mt-3 h-3 w-2/3`} />
              <div className={`${block} mt-2 h-3 w-1/2`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
