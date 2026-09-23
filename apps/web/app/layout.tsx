import type { Metadata, Viewport } from 'next';
import './globals.css';
import { appMetadata, createRootLayout, APP_VIEWPORT } from '@thefibre/shared/root-layout';

// The shared metadata, plus what makes The Fibre installable as a phone app
// (see app/manifest.ts). iOS reads little of the manifest: the home-screen
// icon comes from apple-touch-icon and opening without browser chrome from
// appleWebApp.capable — without them "Add to Home Screen" is a bookmark.
// Same arrangement as apps/connections/app/layout.tsx.
export const metadata: Metadata = {
  ...appMetadata('fibre-platform'),
  applicationName: 'The Fibre',
  appleWebApp: {
    capable: true,
    title: 'The Fibre',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = APP_VIEWPORT;

export default createRootLayout();
