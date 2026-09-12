import type { MetadataRoute } from 'next';
import { APPS } from '@thefibre/shared';

// The phone app — build-order step 7, the capture pillar.
//
// Sjoerd, at the very start of the Connections conversation: *"super easy UX,
// mainly mobile for quick entry"* and *"Separate PWS for tasks and sales input
// (maybe)"*. And on 2026-09-12, directly: *"did you already build the app
// PWS"*. It had not been; there was no manifest anywhere in the monorepo.
//
// ── What this is and is not, stated so nobody over-reads it ─────────────────
//
// This makes Connections INSTALLABLE: an icon on the home screen that opens
// without browser chrome, straight into Today. It is not yet an offline app.
// There is no service worker, so without a connection it behaves like any web
// page does without one. Capturing a note offline and syncing it later is the
// genuinely hard half — autosave already mints a client_ref per note, which is
// the idempotency key an offline queue needs, so the groundwork exists — and
// it is deliberately its own piece of work rather than a footnote to this.
//
// ── Why it opens on Today ───────────────────────────────────────────────────
//
// Because that is the surface with a reason to open it every morning, and the
// agenda at the top of it is the fastest route to a note: the meeting is
// there, the person is a tap away, the popup opens over the page.

export default function manifest(): MetadataRoute.Manifest {
  const brand = APPS['fibre-sales'];
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: '/today',
    // Scope is the whole app, so tapping a person, a tag or the landscape
    // from inside the installed app stays inside it rather than kicking out
    // to a browser tab.
    scope: '/',
    display: 'standalone',
    // READ from apps/connections/app/globals.css, not chosen. The status bar
    // sits against the top bar, which is `--surface` (255 255 255); the splash
    // shows before the content ground, which is `--surface-sunken`
    // (238 241 246). A first draft of this file guessed a warm off-white that
    // matches neither — the same mistake the icon generator made an hour
    // earlier with a guessed background, and fixed the same way.
    //
    // Light values only: a manifest carries one colour, and the app follows the
    // system theme, so dark mode gets a light splash for the instant before the
    // page paints. Acceptable; per-scheme theme colours are a meta-tag concern.
    background_color: '#eef1f6',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Cropped tighter than the others: a maskable icon may be cut to a
      // circle, and the shapes worth keeping are in the middle of the tile.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the home-screen icon. The two things somebody opens this app
    // to do in a hurry: see who they are about to meet, and find a person to
    // write about.
    shortcuts: [
      { name: 'Today', short_name: 'Today', url: '/today' },
      { name: 'Write about someone', short_name: 'People', url: '/people' },
    ],
  };
}
