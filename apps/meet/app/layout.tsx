import type { Metadata, Viewport } from 'next';
import { APPS } from '@thefibre/shared';
import './globals.css';
import { appMetadata, createRootLayout, APP_VIEWPORT } from '@thefibre/shared/root-layout';
import { appleWebAppMetadata } from '@thefibre/shared/pwa';

// The shared metadata every app gets, plus the half that makes iOS and macOS
// treat Meet as an app rather than a bookmark.
//
// Safari reads almost nothing from app/manifest.ts: it takes the home-screen
// icon from `apple-touch-icon`, decides whether to open without browser
// chrome from `appleWebApp.capable`, and uses its own title. Without these,
// "Add to Home Screen" makes a bookmark that opens a browser tab — the thing
// this exists to avoid.
//
// Spread here rather than folded into `appMetadata`: claiming to be a
// standalone app is a decision per app, and in the shared helper it would be
// claimed by all ten at once, including the ones with no icons.
export const metadata: Metadata = {
  ...appMetadata('fibre-meet', process.env),
  ...appleWebAppMetadata(APPS['fibre-meet'].name),
};

export default createRootLayout({ vercelEnv: process.env.VERCEL_ENV });

// `themeColor` is the Android status bar, kept in step with the manifest's —
// both now read the same design token (packages/shared/src/pwa.ts).
export const viewport: Viewport = APP_VIEWPORT;
