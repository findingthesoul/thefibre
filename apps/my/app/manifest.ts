import type { MetadataRoute } from 'next';
import { SURFACES } from '@thefibre/shared';

// My Thread, installable.
//
// Sjoerd, 2026-09-23: "how to open my.thread on desktop (via app)?" — and the
// honest answer was that you could (Safari → File → Add to Dock), but you got
// a generic tile, because this app had no manifest and no icons at all. The
// browser had nothing to name it with or draw.
//
// ── What this is and is NOT ────────────────────────────────────────────────
//
// This makes the portal INSTALLABLE: its own icon, its own window, opening
// straight into the timeline. It is NOT an offline app — there is no service
// worker, so without a connection it behaves like any web page. That matters
// more here than elsewhere: the reason this surface exists is a ticket at a
// door, and a door is exactly where the signal is worst. Offline tickets are
// their own piece of work (the wallet passes are the other half of that
// answer), deliberately not a footnote to this one.
//
// Shape copied from apps/connections/app/manifest.ts rather than invented —
// same four icon files, same purposes, same reasoning about colour.

export default function manifest(): MetadataRoute.Manifest {
  const surface = SURFACES['my-portal'];
  return {
    name: surface.shortLabel,
    short_name: surface.shortLabel,
    description: surface.tagline,
    // The timeline, not a landing page: an installed app opens on the thing
    // you installed it for.
    start_url: '/',
    // The whole app, so a ticket, a membership or an invoice opens inside the
    // window rather than kicking out to a browser tab.
    scope: '/',
    display: 'standalone',
    // READ from packages/shared/src/design/tokens.ts LIGHT, not chosen —
    // this app takes every colour from the shared preset and its globals.css
    // holds no values on purpose (docs/brand-design.md). The splash shows the
    // ground behind cards, `surface-sunken` (247 247 244); the status bar sits
    // against the page, `surface` (255 255 255).
    //
    // Light values only: a manifest carries one colour and the app follows the
    // system theme, so dark mode gets a light splash for the instant before
    // the page paints. Per-scheme colours are a meta-tag concern, not this.
    background_color: '#f7f7f4',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Cropped tighter: a maskable icon may be cut to a circle, and the
      // lettering worth keeping is in the middle of the tile.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the icon. The two things somebody opens this in a hurry to
    // do: show a ticket at a door, and check what they are part of.
    shortcuts: [
      { name: 'Next', short_name: 'Next', url: '/' },
      { name: 'Memberships', short_name: 'Memberships', url: '/memberships' },
    ],
  };
}
