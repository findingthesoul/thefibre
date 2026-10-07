import type { MetadataRoute } from 'next';
import { APPS } from '@thefibre/shared';
import { appManifest } from '@thefibre/shared/pwa';

// The Fibre as a home-screen app (Sjoerd, 2026-09-15: "make a PWA for the
// whole app, and one specific for Connections").
//
// The shape moved to @thefibre/shared/pwa on 2026-10-07, when Meet would
// have been the fourth copy of it. The colours this file used to spell out
// are now derived from the same tokens its comment already pointed at.
//
// Installable, not offline: no service worker. Every page here is rendered on
// the server for one person and full of contacts; caching them on a phone
// would keep personal data on the device past sign-out (brief §13, and the
// reasoning in apps/connections/public/sw.js).

export default function manifest(): MetadataRoute.Manifest {
  const brand = APPS['fibre-platform'];
  return appManifest({
    name: brand.name,
    shortName: brand.shortName,
    description: brand.tagline,
    startUrl: '/dashboard',
    // Long-press the icon: what somebody opens The Fibre for in a hurry.
    shortcuts: [
      { name: 'Contacts', short_name: 'Contacts', url: '/contacts' },
      { name: 'Add person', short_name: 'Add person', url: '/contacts/new' },
      { name: 'Organisations', short_name: 'Organisations', url: '/organisations' },
    ],
  }) as MetadataRoute.Manifest;
}
