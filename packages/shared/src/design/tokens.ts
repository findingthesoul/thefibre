// The Fibre's design tokens — the ONE place every colour of the interface is
// defined. Read docs/brand-design.md before changing anything here.
//
// Sjoerd, 2026-09-14: "make a brand design document as instruction for the
// interface... Ideally you make one reference per item and reuse that, so
// that changes are simple, and app-wide implemented. Think about the old
// fashioned object oriented programming."
//
// Until this file the palette lived in nine tailwind.config files and nine
// globals.css files, copied by hand, and they had already drifted into two
// palettes and four different values for --accent. A change to "the grey of
// a border" was nine edits and a hope. Now it is one edit, here, and every app
// that uses the preset picks it up on its next build.
//
// TOKENS NAME A ROLE, NEVER A COLOUR. `ink-subtle` is "secondary text", not
// "gray-700"; `save` is "this commits your work", not "yellow". So the palette
// can change without a single call site moving, and a call site can be read
// without knowing the palette.
//
// Values are space-separated RGB channels, because Tailwind composes them as
// `rgb(var(--ink) / <alpha>)`, which is what makes `bg-ink/40` work.

export type Palette = Record<TokenName, string>;

export const TOKEN_NAMES = [
  // Grounds, from furthest back to nearest.
  'surface', //         the page
  'surface-sunken', //  insets, sidebars, the canvas behind cards
  'surface-raised', //  cards, dialogs, menus, fields
  // Text.
  'ink', //             primary text, and the default primary button
  'ink-subtle', //      secondary text, labels
  'ink-muted', //       tertiary text, placeholders, meta
  'ink-inverse', //     text on an ink ground
  // Edges.
  'line', //            borders and dividers
  'line-strong', //     hover and focus borders
  // Roles.
  'accent', //          legacy name for the ink-coloured emphasis; prefer a role
  'save', //            the colour of committing: Save buttons, switches that are on
  'booked', //          time that is already spoken for: an agenda block
  'paper', //           the warm ground of a printed document's summary band
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

/** The warm-neutral palette: The Thread, The Fibre, Meet, Members, the portal. */
export const LIGHT: Palette = {
  surface: '255 255 255',
  'surface-sunken': '247 247 244',
  'surface-raised': '255 255 255',
  ink: '17 20 24',
  'ink-subtle': '55 65 81',
  'ink-muted': '107 114 128',
  'ink-inverse': '250 250 247',
  line: '209 213 219',
  'line-strong': '156 163 175',
  accent: '17 20 24',
  // Tailwind yellow-400 — the switches' yellow since before this file existed.
  // Yellow does not invert in dark mode: it stays yellow, with dark text on it.
  save: '250 204 21',
  // A muted slate-blue. Sjoerd, 2026-09-23, looking at the day grid: *"Maybe
  // the agenda items can be colored (full) instead of white."* White cards on
  // a near-white ground read as paper rather than as time that is taken.
  //
  // It is ONE token and not a palette on purpose: he chose a single accent
  // over a colour per calendar, so nothing here claims to distinguish one
  // calendar from another, and no app should read it as a category. The name
  // says what it MEANS — time already spoken for — so the next surface that
  // wants it (a booked slot, a busy block) uses the same one rather than
  // inventing a second blue.
  booked: '203 213 225',
  // The band across the foot of an invoice. Warmer and lighter than `line`,
  // which is what stood there first and read cold and screen-like next to
  // the reference Sjoerd sent (2026-09-24: *"lighter and slightly more
  // yellow"*). It is a PRINT role: paper stock, not a UI surface — which is
  // why it is named for the thing and not for a grey.
  paper: '222 218 205',
};

export const DARK: Palette = {
  surface: '13 15 18',
  'surface-sunken': '9 11 13',
  'surface-raised': '23 26 31',
  ink: '240 241 243',
  'ink-subtle': '156 163 175',
  'ink-muted': '107 114 128',
  'ink-inverse': '13 15 18',
  line: '39 42 48',
  'line-strong': '55 60 68',
  accent: '240 241 243',
  save: '250 204 21',
  // Lighter in ink terms and darker on screen: on a near-black ground a block
  // has to come FORWARD, so this is the same hue carrying the opposite
  // relationship to its background.
  booked: '51 65 85',
  // Print does not invert — a PDF is the same document whatever theme the
  // reader's screen is in. Present because the type demands every role in
  // both palettes, and deliberately the same value.
  paper: '222 218 205',
};

/** `--ink: 17 20 24;` etc., for a CSS rule body. */
export function cssVariables(p: Palette): Record<string, string> {
  return Object.fromEntries(TOKEN_NAMES.map((n) => [`--${n}`, p[n]]));
}
