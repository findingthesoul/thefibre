// The default te-* stylesheet, in its own module WITHOUT 'use client'.
//
// It used to live in embed-generator.tsx, which is a client module — and
// every export of a 'use client' module reaches a Server Component as a
// client-reference proxy, not the value. The settings page calls
// .split('\n') on this string during SSR, so the page 500'd in production
// ("Application error", digest only). A plain shared module is a plain
// string on both sides.

// The full element reference — every te-* class the embeds render, with
// the default look spelled out. Integrators change values, not selectors.
export const DEFAULT_EMBED_CSS = `/* Thread embed — all elements. Paste INSIDE the embed element;
   it only affects this embed (and its popup), never your page. */
.te-card        { background: #ffffff; border: 1px solid #e5e5e2; border-radius: 12px; }
.te-cover       { border-radius: 12px; }
.te-kicker      { color: #8a8a86; letter-spacing: .08em; }         /* EVENT / JOURNEY */
.te-title       { color: #1a1a17; font-size: 20px; }
.te-intention   { color: #55554f; }
.te-meta        { color: #8a8a86; }                                 /* dates · price */
.te-price       { color: #1a1a17; }
.te-label       { color: #8a8a86; }                                 /* section headings */
.te-list        { }                                                 /* the list wrapper */
.te-agenda      { }
.te-agenda-item { }
.te-enrol       { }                                                 /* the enrol card */
.te-input       { border: 1px solid #e5e5e2; border-radius: 6px; }
.te-button      { background: #1a1a17; color: #ffffff; border-radius: 6px; }
`;
