import type { MetadataRoute } from 'next';
import { APPS } from '@thefibre/shared';
import { appManifest } from '@thefibre/shared/pwa';

// Meet, installable.
//
// Sjoerd, 2026-10-07: "meet app go" — he uses Meet more than anything else
// and wants it in the Dock on his Mac and on his iPhone home screen, in its
// own window without browser chrome.
//
// The shape is `appManifest` in @thefibre/shared/pwa, not another copy: three
// apps had hand-written manifests before this one, the third of which opened
// by admitting it was copied from the first. Meet is the first to be built
// from the shared piece, and the other three now read from it too.
//
// Installable is not offline. There is no service worker — Safari does not
// need one to offer "Add to Dock", and a cache that held an authenticated
// page or an API response would be the wrong thing to add in a hurry.

export default function manifest(): MetadataRoute.Manifest {
  const brand = APPS['fibre-meet'];
  return appManifest({
    name: brand.name,
    shortName: brand.shortName,
    description: brand.tagline,
    // The signed-in home. `/` is the public landing and redirects here once
    // there is a session, so starting there would cost a hop every launch.
    startUrl: '/dashboard',
    // Long-press the icon. The sidebar's own order says which two matter:
    // "Bookings first: it is what you open every day. Meeting types are what
    // you set up occasionally."
    shortcuts: [
      { name: 'Bookings', short_name: 'Bookings', url: '/bookings' },
      { name: 'Meeting types', short_name: 'Types', url: '/meeting-types' },
    ],
  }) as MetadataRoute.Manifest;
}
