import type { MetadataRoute } from 'next';
import { SURFACES } from '@thefibre/shared';
import { appManifest } from '@thefibre/shared/pwa';

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
// The shape was copied from apps/connections/app/manifest.ts rather than
// invented, and on 2026-10-07 — when Meet would have been the fourth copy —
// it moved to @thefibre/shared/pwa, where the colours are derived from the
// tokens this file used to spell out.

export default function manifest(): MetadataRoute.Manifest {
  const surface = SURFACES['my-portal'];
  return appManifest({
    name: surface.shortLabel,
    description: surface.tagline,
    // The timeline, not a landing page: an installed app opens on the thing
    // you installed it for.
    startUrl: '/',
    // Long-press the icon. The two things somebody opens this in a hurry to
    // do: show a ticket at a door, and check what they are part of.
    shortcuts: [
      { name: 'Next', short_name: 'Next', url: '/' },
      { name: 'Memberships', short_name: 'Memberships', url: '/memberships' },
    ],
  }) as MetadataRoute.Manifest;
}
