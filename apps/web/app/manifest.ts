import type { MetadataRoute } from 'next';
import { APPS } from '@thefibre/shared';

// The Fibre as a home-screen app (Sjoerd, 2026-09-15: "make a PWA for the
// whole app, and one specific for Connections"). Connections has had its own
// since 2026-09-12 (apps/connections/app/manifest.ts); this is the platform's.
//
// Installable, not offline: no service worker. Every page here is rendered on
// the server for one person and full of contacts; caching them on a phone
// would keep personal data on the device past sign-out (brief §13, and the
// reasoning in apps/connections/public/sw.js). Opening without a connection
// shows the browser's own offline page — acceptable for an admin surface.
//
// Colours are READ from the tokens (packages/shared/src/design/tokens.ts,
// LIGHT): the top bar is `surface` 255 255 255, the canvas `surface-sunken`
// 247 247 244.

export default function manifest(): MetadataRoute.Manifest {
  const brand = APPS['fibre-platform'];
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.tagline,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f7f4',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Cropped tighter: a maskable icon may be cut to a circle.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the icon: what somebody opens The Fibre for in a hurry.
    shortcuts: [
      { name: 'Contacts', short_name: 'Contacts', url: '/contacts' },
      { name: 'Add person', short_name: 'Add person', url: '/contacts/new' },
      { name: 'Organisations', short_name: 'Organisations', url: '/organisations' },
    ],
  };
}
