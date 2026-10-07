import type { MetadataRoute } from 'next';
import { APPS } from '@thefibre/shared';
import { appManifest } from '@thefibre/shared/pwa';

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
  return appManifest({
    name: brand.name,
    shortName: brand.shortName,
    description: brand.tagline,
    startUrl: '/today',
    // THE ONE OVERRIDE in the family, and it is real: this app's globals.css
    // sets `--surface-sunken: 238 241 246`, so the shared token would give it
    // a splash in a colour it never paints. Read from there, not chosen — a
    // first draft of this file guessed a warm off-white that matched neither.
    backgroundColor: '#eef1f6',
    // Long-press the home-screen icon. The two things somebody opens this app
    // to do in a hurry: see who they are about to meet, and find a person to
    // write about.
    shortcuts: [
      { name: 'Today', short_name: 'Today', url: '/today' },
      { name: 'Write about someone', short_name: 'People', url: '/people' },
    ],
  }) as MetadataRoute.Manifest;
}
