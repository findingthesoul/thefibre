// The timeline: a rail, a dot per entry, a quiet line of provenance, and what
// happened underneath it.
//
//     19 AUG 2026, 09:28 · THE THREAD · EVENT_REGISTERED
//     Registered: Post-Athens journey
//
// Sjoerd, 2026-09-13, looking at Connections' list of conversations beside The
// Fibre's activity trail: *"Is it an idea that the timeline has the same
// design as the fibre? DATE, TYPE .... Content...."*
//
// It was the same design already, written twice — once inline in the Fibre
// contact page and once, differently, in Connections. This is that markup
// extracted, which is the components-first rule (CLAUDE.md): if it exists
// anywhere, use the shared one or extract it and port the copies.
//
// ── What this component decides, and what it does not ──────────────────────
//
// It decides the SHAPE: the rail, the dot, a small-caps provenance line above
// a normal-weight content line, and the spacing between entries.
//
// It decides nothing about the WORDS. `meta` and the children are handed in
// whole, because the two callers differ in every part of them — the Fibre
// formats a date in the reader's locale and names an app from the catalogue;
// Connections names a kind of conversation from its own typed catalogue and
// has a follow-up date to add. A component that tried to own that would need
// a prop per caller and would be a worse version of both. (Design note, this
// repo: shared decides WHAT, the caller decides HOW.)
//
// `actions` exists for the same reason in reverse: Connections needs edit and
// delete controls on an entry and the Fibre's activity is append-only and must
// never grow them, so the slot is optional and empty by default.

import type { ReactNode } from 'react';

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="mt-4 space-y-6 border-l border-line pl-6">{children}</ol>;
}

export function TimelineItem({
  meta,
  actions,
  children,
}: {
  /** The quiet line: date · where it came from · what kind of thing it is. */
  meta: ReactNode;
  /** Optional controls, sitting with the meta line rather than the content,
   *  so they never push the thing somebody is reading out of place. */
  actions?: ReactNode;
  /** What happened. */
  children: ReactNode;
}) {
  return (
    <li className="relative">
      {/* -27px puts the dot on the rail: 24px of padding plus half the dot.
          A magic number, and the alternative — a wrapper per entry just to
          hang a border on — costs more than the comment does. */}
      <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-ink" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="text-xs uppercase tracking-wider text-ink-muted">{meta}</div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </li>
  );
}
