// Recipes — the one reference for every recurring piece of the interface that
// is not worth a component of its own. Read docs/brand-design.md first.
//
// Sjoerd, 2026-09-14: "one reference per item and reuse that, so that changes
// are simple, and app-wide implemented. Think about the old fashioned object
// oriented programming." A recipe is the class; every place it is used is an
// instance. Change the recipe and every instance changes with it.
//
// Why these and not others: they are what was counted being written out by
// hand across the nine apps before this file existed —
//
//   the error notice box         54 copies in 46 files
//   the small uppercase label   101 copies in 59 files
//   the raised card             103 copies in 74 files
//   red error text              160 copies in 120 files
//   the amber warning box        13 copies in 12 files
//   the green status pill        11 copies in 11 files
//
// THE RULE: if you are about to type a colour or a border for one of these,
// import the recipe instead. If what you need is not here and you are about to
// write it a second time, add it here first. Components (Button, TextField,
// Dialog, SwitchField…) are the other half of the same idea, for things with
// behaviour; a recipe is for things that are only a look.
//
// Recipes compose with Tailwind: `${CARD} p-5`. They never carry margins —
// where a thing sits is the caller's business, what it looks like is not.

// Field looks (FIELD_BOX and friends) live in ./fields.tsx beside the field
// components that use them, and are NOT re-exported here. This module must stay
// importable from a server component with no client module in its graph —
// handbook §12, "Sharing a constant between a server and a client component".

/** A small uppercase label above a section: "WHAT'S ON", "COMING UP".
 *  The `SectionLabel` component in ui/page.tsx renders exactly this. */
export const SECTION_LABEL = 'text-[10px] uppercase tracking-wider text-ink-muted';

/** A raised card: a listing row group, a panel, a tile. Add your own padding. */
export const CARD = 'rounded-lg border border-line bg-surface-raised';

/** A sunken inset: a quiet tile, an empty state, a code block ground.
 *  `EmptyState` in ui/page.tsx is this plus padding and quiet text. */
export const INSET = 'rounded-lg border border-line bg-surface-sunken';

/** Inline error text under a field or beside an action. `FormError` in
 *  ui/form-error.tsx is this with an icon. */
export const ERROR_TEXT = 'text-sm text-red-700';

/** A boxed message. Pick the tone by what the reader must do:
 *  error — something failed; warning — it worked but read this first;
 *  success — it worked and they might not otherwise know; info — context. */
export const NOTICE = {
  error:
    'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300',
  warning:
    'rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200',
  success:
    'rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200',
  info: 'rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-sm text-ink-subtle',
} as const;

/** A small rounded status label: a thread's status, an RSVP answer, a payment
 *  state. The tone names what the state MEANS, not what colour it is. */
export const PILL = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1';
export const PILL_TONE = {
  /** Live, confirmed, paid, coming. */
  positive:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/40',
  /** Done and closed: completed, issued. */
  done: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-900/40',
  /** Needs somebody: pending, awaiting approval, unpaid. */
  attention:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/40',
  /** Not started or set aside: draft, archived, no answer. */
  neutral: 'bg-surface-sunken text-ink-subtle ring-line',
  /** Failed or refused. */
  negative:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/40',
} as const;
export type PillTone = keyof typeof PILL_TONE;

/** A filter chip in a row of filters. `on` is the chosen one. */
export const CHIP = 'rounded-full px-3 py-1.5 text-xs ring-1 transition-colors';
export const CHIP_STATE = {
  on: 'bg-ink text-ink-inverse ring-ink',
  off: 'bg-surface-raised text-ink-subtle ring-line hover:text-ink',
} as const;
