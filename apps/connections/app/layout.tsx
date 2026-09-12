import type { Metadata, Viewport } from 'next';
import './globals.css';
import { appMetadata, createRootLayout } from '@thefibre/shared/root-layout';

// The shared metadata every app gets, plus what makes Connections installable
// as a phone app. Extended HERE rather than in `appMetadata`, because the
// home-screen behaviour is a decision for this app — changing the shared
// helper would make all eight apps claim to be standalone apps at once.
//
// iOS needs its own tags. Safari reads very little of app/manifest.ts: it
// takes the home-screen icon from `apple-touch-icon`, decides whether to open
// without browser chrome from `appleWebApp.capable`, and uses its own title.
// Without these, "Add to Home Screen" on an iPhone produces a bookmark that
// opens a browser tab, which is the thing this exists to avoid.
export const metadata: Metadata = {
  ...appMetadata('fibre-sales', process.env),
  applicationName: 'Connections',
  appleWebApp: {
    capable: true,
    title: 'Connections',
    // `default` keeps the status bar legible against the white top bar.
    // `black-translucent` would draw the app under it and needs safe-area
    // padding the shell does not have.
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

// The status bar colour on Android. Kept in step with the manifest's
// theme_color, which is read from `--surface` in globals.css.
export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default createRootLayout();
